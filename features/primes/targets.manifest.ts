import assert from "node:assert/strict";
import path from "node:path";

import { openAcidCat } from "@heb-stack/acidcat";
import type { AcidCatServices, WebMcp } from "@heb-stack/acidcat";
import { primeMathWasmLayer } from "@heb-stack/acidcat/primes";
import { checkHistoryLocalLayer } from "@heb-stack/browser-runtime";
import { edgeRpcResponse } from "@heb-stack/edge-runtime";
import { PRIMES_RPC_PATH } from "@heb-stack/rpc";
import type { PrimesApi } from "@heb-stack/rpc";
import { newHttpBatchRpcSession } from "capnweb";
import { Effect, Layer, Schema } from "effect";
import { vi } from "vitest";

import {
  decodeAdapterAnswer,
  requireBuiltAdapter,
  runBuiltAdapter,
} from "../support/adapter-process.ts";
import { eventually } from "../support/eventually.ts";
import {
  integerStepArgument,
  noStepArguments,
  step,
  stringStepArgument,
} from "../support/manifest.ts";
import type { ExecutableFeatureManifest } from "../support/manifest.ts";
import {
  listedTools,
  mcpRequest,
  ORIGIN,
  workerMcpEndpoint,
} from "../support/mcp-client.ts";
import {
  compiledCrate,
  memoryStorage,
  REPOSITORY_ROOT,
  required,
  scopedSession,
} from "../support/sessions.ts";

/** The one bundled entry point `moon run cli:build` writes. */
const CLI_ENTRY = path.resolve(REPOSITORY_ROOT, ".artifacts/cli/main.js");

/** What `cli list` prints: one entry per capability of the view. */
const CliListingSchema = Schema.Array(Schema.Struct({ id: Schema.String }));

interface World {
  /** The page's services, which the WebMCP step opens a session over. */
  webServices?: AcidCatServices;
  /** The crate a Worker session runs, for the `mcp` and `rpc` endpoints. */
  module?: WebAssembly.Module;
  listing?: readonly string[];
  refusal?: { readonly code: number; readonly message: string };
  status?: number;
}

function setListing(world: World, ids: Iterable<string>): void {
  world.listing = [...ids].toSorted((left, right) => left.localeCompare(right));
}

/** The capnweb API the Worker answers at `/rpc`, over the crate. */
async function workerRpc(
  module: WebAssembly.Module,
  request: Request
): Promise<Response> {
  return await edgeRpcResponse(request, { module, origin: ORIGIN });
}

export const targetsFeature: ExecutableFeatureManifest<World> = {
  capabilityIds: [
    "primes.check",
    "primes.next",
    "primes.history.list",
    "primes.history.clear",
  ],
  createWorld: () => ({}),
  id: "targets",
  steps: [
    step("a web session", noStepArguments, (world) =>
      Effect.gen(function* () {
        const module = yield* compiledCrate;
        world.webServices = Layer.merge(
          primeMathWasmLayer(module),
          checkHistoryLocalLayer(memoryStorage())
        );
      })
    ),
    step("a cli session", noStepArguments, () =>
      Effect.promise(async () => {
        await requireBuiltAdapter(CLI_ENTRY, "cli:build");
      })
    ),
    step("an {word} session", stringStepArgument, (world, target) =>
      Effect.gen(function* () {
        assert.ok(
          target === "mcp" || target === "rpc",
          `${target} is not a Worker target`
        );
        world.module = yield* compiledCrate;
      })
    ),
    step("the WebMCP adapter registers its tools", noStepArguments, (world) =>
      Effect.gen(function* () {
        const services = required(world.webServices, "web services");
        const registered = new Set<string>();
        const host: WebMcp.ModelContext = {
          registerTool: (tool, options) => {
            registered.add(tool.name);
            options.signal.addEventListener("abort", () => {
              registered.delete(tool.name);
            });
          },
        };
        const root = yield* scopedSession(
          async () =>
            await openAcidCat(services, { target: "web", webmcp: host })
        );
        const webmcp = required(root.webmcp, "WebMCP");
        yield* Effect.promise(async () => {
          await eventually(() => {
            const status = webmcp.status.getSnapshot();
            assert.equal(status.phase, "ready", status.message ?? "");
          });
        });
        setListing(world, registered);
      })
    ),
    step("the command line lists its capabilities", noStepArguments, (world) =>
      Effect.promise(async () => {
        const run = await runBuiltAdapter(CLI_ENTRY, "list");
        assert.equal(run.status, 0, run.stderr);
        setListing(
          world,
          decodeAdapterAnswer(CliListingSchema, run.stdout).map(
            (entry) => entry.id
          )
        );
      })
    ),
    step("an MCP client lists the tools", noStepArguments, (world) =>
      Effect.promise(async () => {
        const module = required(world.module, "crate");
        setListing(world, await listedTools(workerMcpEndpoint(module)));
      })
    ),
    step(
      "a capnweb client asks the API for its capabilities",
      noStepArguments,
      (world) =>
        Effect.gen(function* () {
          const module = required(world.module, "crate");
          // The client's batch reaches the Worker's own handler, so both ends of capnweb run unchanged.
          vi.stubGlobal(
            "fetch",
            async (input: RequestInfo | URL, init?: RequestInit) =>
              await workerRpc(module, new Request(input, init))
          );
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => vi.unstubAllGlobals())
          );
          const session = yield* Effect.acquireRelease(
            Effect.sync(() =>
              newHttpBatchRpcSession<PrimesApi>(
                new Request(`${ORIGIN}${PRIMES_RPC_PATH}`, {
                  headers: { Origin: ORIGIN },
                  method: "POST",
                })
              )
            ),
            (stub) =>
              Effect.sync(() => {
                stub[Symbol.dispose]();
              })
          );
          const capabilities: readonly string[] = yield* Effect.promise(
            async () => await session.capabilities()
          );
          setListing(world, capabilities);
        })
    ),
    step(
      "a capnweb client sends a batch that is not UTF-8",
      noStepArguments,
      (world) =>
        Effect.promise(async () => {
          const response = await workerRpc(
            required(world.module, "crate"),
            new Request(`${ORIGIN}${PRIMES_RPC_PATH}`, {
              // 0xFF never appears in UTF-8.
              body: new Uint8Array([0xff, 0xfe]),
              headers: { "Content-Type": "text/plain", Origin: ORIGIN },
              method: "POST",
            })
          );
          world.status = response.status;
        })
    ),
    step("an MCP client calls {string}", stringStepArgument, (world, name) =>
      Effect.promise(async () => {
        const message = await mcpRequest(
          workerMcpEndpoint(required(world.module, "crate")),
          "tools/call",
          { arguments: {}, name },
          name
        );
        world.refusal = required(message.error, "refusal");
      })
    ),
    step("the listing is {string}", stringStepArgument, (world, expected) => {
      assert.deepEqual(
        required(world.listing, "listing"),
        expected.split(", ")
      );
    }),
    step(
      "the API answers with status {int}",
      integerStepArgument,
      (world, status) => {
        assert.equal(required(world.status, "status"), status);
      }
    ),
    step(
      "the call is refused as an unknown tool named {string}",
      stringStepArgument,
      (world, name) => {
        const refusal = required(world.refusal, "refusal");
        assert.equal(
          refusal.code,
          -32_602,
          "An unknown tool is a protocol answer"
        );
        assert.ok(
          refusal.message.includes(name),
          `The refusal does not name ${name}: ${refusal.message}`
        );
      }
    ),
  ],
  uri: "features/primes/targets.feature",
};
