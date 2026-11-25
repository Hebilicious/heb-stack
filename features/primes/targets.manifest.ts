import assert from "node:assert/strict";
import path from "node:path";

import { Effect, Schema } from "effect";

import {
  decodeAdapterAnswer,
  requireBuiltAdapter,
  runBuiltAdapter,
} from "../support/adapter-process.ts";
import {
  noStepArguments,
  step,
  stringStepArgument,
} from "../support/manifest.ts";
import type { ExecutableFeatureManifest } from "../support/manifest.ts";
import { listedTools, workerMcpEndpoint } from "../support/mcp-client.ts";
import {
  compiledCrate,
  REPOSITORY_ROOT,
  required,
} from "../support/sessions.ts";

/** The one bundled entry point `moon run cli:build` writes. */
const CLI_ENTRY = path.resolve(REPOSITORY_ROOT, ".artifacts/cli/main.js");

/** What `cli list` prints: one entry per capability of the view. */
const CliListingSchema = Schema.Array(Schema.Struct({ id: Schema.String }));

interface World {
  /** The crate the Worker's MCP endpoint runs. */
  module?: WebAssembly.Module;
  listing?: readonly string[];
}

function setListing(world: World, ids: Iterable<string>): void {
  world.listing = [...ids].toSorted((left, right) => left.localeCompare(right));
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
    step("a cli session", noStepArguments, () =>
      Effect.promise(async () => {
        await requireBuiltAdapter(CLI_ENTRY, "cli:build");
      })
    ),
    step("an mcp session", noStepArguments, (world) =>
      Effect.gen(function* () {
        world.module = yield* compiledCrate;
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
    step("the listing is {string}", stringStepArgument, (world, expected) => {
      assert.deepEqual(
        required(world.listing, "listing"),
        expected.split(", ")
      );
    }),
  ],
  uri: "features/primes/targets.feature",
};
