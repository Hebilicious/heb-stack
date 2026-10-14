import assert from "node:assert/strict";

import { openAcidCat } from "@heb-stack/acidcat";
import type { AcidCat, Result } from "@heb-stack/acidcat";
import {
  CheckOutputSchema,
  NextOutputSchema,
  OutOfRangeSchema,
  primeMathWasmLayer,
} from "@heb-stack/acidcat/primes";
import { Effect } from "effect";

import {
  integerPairStepArguments,
  integerStepArgument,
  noStepArguments,
  step,
} from "../support/manifest.ts";
import type { ExecutableFeatureManifest } from "../support/manifest.ts";
import {
  compiledCrate,
  decode,
  required,
  scopedSession,
} from "../support/sessions.ts";

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
  capabilityIds: ["primes.check", "primes.next"],
  createWorld: () => ({}),
  id: "primes",
  steps: [
    step("a session over the compiled crate", noStepArguments, (world) =>
      Effect.gen(function* () {
        const module = yield* compiledCrate;
        world.root = yield* scopedSession(
          async () =>
            await openAcidCat(primeMathWasmLayer(module), { target: "cli" })
        );
      })
    ),
    step("the session checks {int}", integerStepArgument, (world, n) =>
      Effect.gen(function* () {
        const { check } = required(world.root, "session").catalog.primes;
        world.result = yield* Effect.promise(
          async () => await check.invokeExternal({ n })
        );
      })
    ),
    step(
      "the session asks for the next prime after {int}",
      integerStepArgument,
      (world, after) =>
        Effect.gen(function* () {
          const { next } = required(world.root, "session").catalog.primes;
          world.result = yield* Effect.promise(
            async () => await next.invokeExternal({ after })
          );
        })
    ),
    step("the answer is prime", noStepArguments, (world) => {
      assert.equal(decode(CheckOutputSchema, answer(world)).prime, true);
    }),
    step("the answer is composite", noStepArguments, (world) => {
      assert.equal(decode(CheckOutputSchema, answer(world)).prime, false);
    }),
    step(
      "its smallest factor is {int}",
      integerStepArgument,
      (world, factor) => {
        assert.equal(
          decode(CheckOutputSchema, answer(world)).smallestFactor,
          factor
        );
      }
    ),
    step("the next prime is {int}", integerStepArgument, (world, prime) => {
      assert.equal(decode(NextOutputSchema, answer(world)).prime, prime);
    }),
    step(
      "the call is refused as out of range from {int} to {int}",
      integerPairStepArguments,
      (world, min, max) => {
        const result = required(world.result, "answer");
        assert.ok(!result.ok, "An out-of-range number must be refused");
        const failure = decode(OutOfRangeSchema, result.error);
        assert.deepEqual([failure.min, failure.max], [min, max]);
      }
    ),
  ],
  uri: "features/primes/primes.feature",
};
