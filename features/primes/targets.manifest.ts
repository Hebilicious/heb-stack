import assert from "node:assert/strict";
import { createAcidCat, type AcidCat, type ModelContextPort, type WebMcpStatus } from "@heb-stack/acidcat";
import { definitions } from "@heb-stack/acidcat/catalog";
import { primeMathWasmLayer } from "@heb-stack/acidcat/primes";
import { checkHistoryLocalLayer } from "@heb-stack/browser-runtime";
import { commandCatalogEntries } from "@heb-stack/cli/catalog";
import { createEdgeAcidCat } from "@heb-stack/edge-runtime";
import { createNodeAcidCat, DEFAULT_WASM_PATH } from "@heb-stack/node-runtime";
import { PRIMES_RPC_PATH, type PrimesApi } from "@heb-stack/rpc";
import { primesRpcResponse } from "@heb-stack/rpc/server";
import { buildManifest } from "@heb-stack/webmcp-adapter/manifest";
import { newHttpBatchRpcSession } from "capnweb";
import { Effect, Layer } from "effect";
import { vi } from "vitest";
import { eventually } from "../support/eventually.ts";
import { noStepArguments, step, stringStepArgument, type ExecutableFeatureManifest } from "../support/manifest.ts";
import { listedTools, mcpRequest, ORIGIN } from "../support/mcp-client.ts";
import { compiledCrate, memoryStorage, required, scopedSession } from "../support/sessions.ts";

interface World {
  root?: AcidCat;
  listing?: readonly string[];
  refusal?: { readonly code: number; readonly message: string };
}

function sorted(ids: Iterable<string>): readonly string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function setListing(world: World, ids: Iterable<string>): void {
  world.listing = sorted(ids);
}

export const targetsFeature: ExecutableFeatureManifest<World> = {
  id: "targets",
  uri: "features/primes/targets.feature",
  capabilityIds: ["primes.check", "primes.next", "history.list", "history.clear"],
  createWorld: () => ({}),
  steps: [
    step("a web session", noStepArguments, (world) =>
      Effect.gen(function* () {
        const module = yield* compiledCrate;
        const services = Layer.merge(primeMathWasmLayer(module), checkHistoryLocalLayer(memoryStorage()));
        world.root = yield* scopedSession(() => createAcidCat({ target: "web" }, services));
      }),
    ),
    step("a cli session", noStepArguments, (world) =>
      Effect.gen(function* () {
        world.root = yield* scopedSession(() =>
          createNodeAcidCat({ target: "cli", wasmPath: DEFAULT_WASM_PATH, historyFile: null }),
        );
      }),
    ),
    step("an {word} session", stringStepArgument, (world, target) =>
      Effect.gen(function* () {
        assert.ok(target === "mcp" || target === "rpc", `${target} is not a Worker target`);
        const module = yield* compiledCrate;
        world.root = yield* scopedSession(() => createEdgeAcidCat({ target, module }));
      }),
    ),
    step("the WebMCP adapter registers its tools", noStepArguments, (world) =>
      Effect.gen(function* () {
        const root = required(world.root, "session");
        const registered = new Set<string>();
        const port: ModelContextPort = {
          registerTool: (tool, options) => {
            registered.add(tool.name);
            options.signal.addEventListener("abort", () => registered.delete(tool.name));
            return Promise.resolve(undefined);
          },
        };
        const manifest = yield* buildManifest(definitions);
        const webmcp = yield* Effect.acquireRelease(
          Effect.promise(() => root.installWebMcp(port, () => Promise.resolve(manifest))),
          (adapter) => Effect.promise(() => adapter.dispose()),
        );
        yield* Effect.promise(() =>
          eventually(() => {
            const status: WebMcpStatus = webmcp.snapshot.getSnapshot();
            assert.equal(status.phase, "ready", status.message ?? "");
          }),
        );
        setListing(world, registered);
      }),
    ),
    step("the command line lists its capabilities", noStepArguments, (world) => {
      setListing(
        world,
        commandCatalogEntries(required(world.root, "session").catalog, "cli").map((entry) => entry.id),
      );
    }),
    step("an MCP client lists the tools", noStepArguments, (world) =>
      Effect.promise(() => listedTools(required(world.root, "session").catalog)).pipe(
        Effect.map((names) => setListing(world, names)),
      ),
    ),
    step("a capnweb client asks the API for its capabilities", noStepArguments, (world) =>
      Effect.gen(function* () {
        const catalog = required(world.root, "session").catalog;
        // The client's batch reaches the Worker's own handler, so both ends of capnweb run unchanged.
        vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
          primesRpcResponse(new Request(input, init), ORIGIN, catalog),
        );
        yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllGlobals()));
        const session = yield* Effect.acquireRelease(
          Effect.sync(() =>
            newHttpBatchRpcSession<PrimesApi>(
              new Request(`${ORIGIN}${PRIMES_RPC_PATH}`, { method: "POST", headers: { Origin: ORIGIN } }),
            ),
          ),
          (stub) => Effect.sync(() => stub[Symbol.dispose]()),
        );
        const capabilities: readonly string[] = yield* Effect.promise(() => session.capabilities());
        setListing(world, capabilities);
      }),
    ),
    step("an MCP client calls {string}", stringStepArgument, (world, name) =>
      Effect.promise(() =>
        mcpRequest(required(world.root, "session").catalog, "tools/call", { name, arguments: {} }, name),
      ).pipe(
        Effect.map((message) => {
          world.refusal = required(message.error, "refusal");
        }),
      ),
    ),
    step("the listing is {string}", stringStepArgument, (world, expected) => {
      assert.deepEqual(required(world.listing, "listing"), expected.split(", "));
    }),
    step("the call is refused as an unknown tool named {string}", stringStepArgument, (world, name) => {
      const refusal = required(world.refusal, "refusal");
      assert.equal(refusal.code, -32_602, "An unknown tool is a protocol answer");
      assert.ok(refusal.message.includes(name), `The refusal does not name ${name}: ${refusal.message}`);
    }),
  ],
};
