import assert from "node:assert/strict";
import { createAcidCat, type AcidCat, type Result } from "@heb-stack/acidcat";
import { CheckOutputSchema, NextOutputSchema, OutOfRangeSchema, primeMathWasmLayer } from "@heb-stack/acidcat/primes";
import { Effect } from "effect";
import {
  integerPairStepArguments,
  integerStepArgument,
  noStepArguments,
  step,
  type ExecutableFeatureManifest,
} from "../support/manifest.ts";
import { compiledCrate, decode, required, scopedSession } from "../support/sessions.ts";

interface World {
  root?: AcidCat;
  result?: Result<unknown, unknown>;
}

function answer(world: World) {
  const result = required(world.result, "answer");
  assert.ok(result.ok, `The call failed: ${JSON.stringify(result)}`);
  return result.value;
}

export const primesFeature: ExecutableFeatureManifest<World> = {
  id: "primes",
  uri: "features/primes/primes.feature",
  capabilityIds: ["primes.check", "primes.next"],
  createWorld: () => ({}),
  steps: [
    step("a session over the compiled crate", noStepArguments, (world) =>
      Effect.gen(function* () {
        const module = yield* compiledCrate;
        world.root = yield* scopedSession(() => createAcidCat({ target: "cli" }, primeMathWasmLayer(module)));
      }),
    ),
    step("the session checks {int}", integerStepArgument, (world, n) =>
      Effect.promise(() => required(world.root, "session").catalog.primes.check.invokeExternal({ n })).pipe(
        Effect.map((result) => {
          world.result = result;
        }),
      ),
    ),
    step("the session asks for the next prime after {int}", integerStepArgument, (world, after) =>
      Effect.promise(() => required(world.root, "session").catalog.primes.next.invokeExternal({ after })).pipe(
        Effect.map((result) => {
          world.result = result;
        }),
      ),
    ),
    step("the answer is prime", noStepArguments, (world) => {
      assert.equal(decode(CheckOutputSchema, answer(world)).prime, true);
    }),
    step("the answer is composite", noStepArguments, (world) => {
      assert.equal(decode(CheckOutputSchema, answer(world)).prime, false);
    }),
    step("its smallest factor is {int}", integerStepArgument, (world, factor) => {
      assert.equal(decode(CheckOutputSchema, answer(world)).smallestFactor, factor);
    }),
    step("the next prime is {int}", integerStepArgument, (world, prime) => {
      assert.equal(decode(NextOutputSchema, answer(world)).prime, prime);
    }),
    step("the call is refused as out of range from {int} to {int}", integerPairStepArguments, (world, min, max) => {
      const result = required(world.result, "answer");
      assert.ok(!result.ok, "An out-of-range number must be refused");
      const failure = decode(OutOfRangeSchema, result.error);
      assert.deepEqual([failure.min, failure.max], [min, max]);
    }),
  ],
};
