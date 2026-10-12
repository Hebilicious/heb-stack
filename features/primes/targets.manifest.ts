import assert from "node:assert/strict";

import { createAcidCat } from "@heb-stack/acidcat";
import type {
  AcidCat,
  ModelContextPort,
  WebMcpStatus,
} from "@heb-stack/acidcat";
import { definitions } from "@heb-stack/acidcat/catalog";
import { primeMathWasmLayer } from "@heb-stack/acidcat/primes";
import { checkHistoryLocalLayer } from "@heb-stack/browser-runtime";
import { commandCatalogEntries } from "@heb-stack/cli/catalog";
import { createEdgeAcidCat } from "@heb-stack/edge-runtime";
import { createNodeAcidCat } from "@heb-stack/node-runtime";
import { PRIMES_RPC_PATH } from "@heb-stack/rpc";
import type { PrimesApi } from "@heb-stack/rpc";
import { primesRpcResponse } from "@heb-stack/rpc/server";
import { buildManifest } from "@heb-stack/webmcp-adapter/manifest";
import { newHttpBatchRpcSession } from "capnweb";
import { Effect, Layer } from "effect";
import { vi } from "vitest";

import { eventually } from "../support/eventually.ts";
import {
  integerStepArgument,
  noStepArguments,
  step,
  stringStepArgument,
} from "../support/manifest.ts";
import type { ExecutableFeatureManifest } from "../support/manifest.ts";
import { listedTools, mcpRequest, ORIGIN } from "../support/mcp-client.ts";
import {
  compiledCrate,
  CRATE_PATH,
  memoryStorage,
  required,
  scopedSession,
} from "../support/sessions.ts";

interface World {
  root?: AcidCat;
  listing?: readonly string[];
  refusal?: { readonly code: number; readonly message: string };
  status?: number;
}

function sorted(ids: Iterable<string>): readonly string[] {
  return [...ids].toSorted((left, right) => left.localeCompare(right));
}

function setListing(world: World, ids: Iterable<string>): void {
  world.listing = sorted(ids);
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
        const services = Layer.merge(
          primeMathWasmLayer(module),
          checkHistoryLocalLayer(memoryStorage())
        );
        world.root = yield* scopedSession(
          async () => await createAcidCat({ target: "web" }, services)
        );
      })
    ),
    step("a cli session", noStepArguments, (world) =>
      Effect.gen(function* () {
        world.root = yield* scopedSession(
          async () =>
            await createNodeAcidCat({
              historyFile: null,
              target: "cli",
              wasmPath: CRATE_PATH,
            })
        );
      })
    ),
    step("an {word} session", stringStepArgument, (world, target) =>
      Effect.gen(function* () {
        assert.ok(
          target === "mcp" || target === "rpc",
          `${target} is not a Worker target`
        );
        const module = yield* compiledCrate;
        world.root = yield* scopedSession(
          async () => await createEdgeAcidCat({ module, target })
        );
      })
    ),
    step("the WebMCP adapter registers its tools", noStepArguments, (world) =>
      Effect.gen(function* () {
        const root = required(world.root, "session");
        const registered = new Set<string>();
        const port: ModelContextPort = {
          // oxlint-disable-next-line require-await -- a recording port registers at once behind the asynchronous host contract.
          registerTool: async (tool, options) => {
            registered.add(tool.name);
            options.signal.addEventListener("abort", () => {
              registered.delete(tool.name);
            });
          },
        };
        const manifest = yield* buildManifest(definitions);
        const webmcp = yield* Effect.acquireRelease(
          Effect.promise(
            async () =>
              // oxlint-disable-next-line require-await -- the manifest is already built; the loader keeps its asynchronous contract.
              await root.installWebMcp(port, async () => manifest)
          ),
          (adapter) =>
            Effect.promise(async () => {
              await adapter.dispose();
            })
        );
        yield* Effect.promise(async () => {
          await eventually(() => {
            const status: WebMcpStatus = webmcp.snapshot.getSnapshot();
            assert.equal(status.phase, "ready", status.message ?? "");
          });
        });
        setListing(world, registered);
      })
    ),
    step(
      "the command line lists its capabilities",
      noStepArguments,
      (world) => {
        setListing(
          world,
          commandCatalogEntries(
            required(world.root, "session").catalog,
            "cli"
          ).map((entry) => entry.id)
        );
      }
    ),
    step("an MCP client lists the tools", noStepArguments, (world) =>
      Effect.gen(function* () {
        const { catalog } = required(world.root, "session");
        setListing(
          world,
          yield* Effect.promise(async () => await listedTools(catalog))
        );
      })
    ),
    step(
      "a capnweb client asks the API for its capabilities",
      noStepArguments,
      (world) =>
        Effect.gen(function* () {
          const { catalog } = required(world.root, "session");
          // The client's batch reaches the Worker's own handler, so both ends of capnweb run unchanged.
          vi.stubGlobal(
            "fetch",
            async (input: RequestInfo | URL, init?: RequestInit) =>
              await primesRpcResponse(new Request(input, init), ORIGIN, catalog)
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
        Effect.gen(function* () {
          const { catalog } = required(world.root, "session");
          const response = yield* Effect.promise(
            async () =>
              await primesRpcResponse(
                new Request(`${ORIGIN}${PRIMES_RPC_PATH}`, {
                  // 0xFF never appears in UTF-8.
                  body: new Uint8Array([0xff, 0xfe]),
                  headers: { "Content-Type": "text/plain", Origin: ORIGIN },
                  method: "POST",
                }),
                ORIGIN,
                catalog
              )
          );
          world.status = response.status;
        })
    ),
    step("an MCP client calls {string}", stringStepArgument, (world, name) =>
      Effect.gen(function* () {
        const { catalog } = required(world.root, "session");
        const message = yield* Effect.promise(
          async () =>
            await mcpRequest(
              catalog,
              "tools/call",
              { arguments: {}, name },
              name
            )
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
