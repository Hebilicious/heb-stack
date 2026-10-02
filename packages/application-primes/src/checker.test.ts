import assert from "node:assert/strict";
import { Context, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { testEffect } from "../../../features/support/vitest-adapter.ts";
import { PrimeChecker, primeCheckerLayer } from "./checker.ts";
import { PrimeMath } from "./services.ts";

/** What one call for a number does: answer a factor, die, or hold until interrupted. */
type Outcome = bigint | "die" | "hold";

/**
 * Arithmetic that follows a script, one outcome per call, so every proof below is ordered by events rather than by a
 * clock. A held call reports when it starts and whether it was interrupted.
 */
function scriptedMath(script: ReadonlyMap<bigint, readonly Outcome[]>) {
  return Effect.gen(function* () {
    const remaining = new Map([...script].map(([n, outcomes]) => [n, [...outcomes]]));
    const held = yield* Deferred.make<void>();
    const interrupted = yield* Deferred.make<void>();
    const smallestFactor = (n: bigint) =>
      Effect.suspend(() => {
        const outcome = remaining.get(n)?.shift();
        if (outcome === undefined) return Effect.die(`The script has no answer for ${n}`);
        if (outcome === "die") return Effect.die(`The service behind ${n} failed`);
        if (outcome === "hold")
          return Deferred.succeed(held, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)),
          );
        return Effect.succeed(outcome);
      });
    return { layer: Layer.succeed(PrimeMath, PrimeMath.of({ smallestFactor })), held, interrupted };
  });
}

/** The owner, built into the proof's own scope so its actor lives until the proof ends. */
function checkerOver(math: Layer.Layer<PrimeMath>) {
  return Layer.build(primeCheckerLayer.pipe(Layer.provide(math))).pipe(Effect.map(Context.get(PrimeChecker)));
}

testEffect("a new number interrupts the check in flight, and only the newest caller is answered", () =>
  Effect.gen(function* () {
    const math = yield* scriptedMath(
      new Map<bigint, readonly Outcome[]>([
        [97n, ["hold"]],
        [91n, [7n]],
      ]),
    );
    const checker = yield* checkerOver(math.layer);
    const first = yield* Effect.forkChild(checker.check(97));
    yield* Deferred.await(math.held);
    assert.equal(yield* checker.check(91).pipe(Effect.map((answer) => answer.smallestFactor)), 7);
    yield* Deferred.await(math.interrupted);
    assert.ok(Exit.hasInterrupts(yield* Fiber.await(first)), "The replaced caller ends interrupted, not answered");
    assert.equal(checker.snapshot.getSnapshot().status, "result");
  }),
);

testEffect("checking the number that just failed retries it", () =>
  Effect.gen(function* () {
    const math = yield* scriptedMath(new Map<bigint, readonly Outcome[]>([[13n, ["die", 13n]]]));
    const checker = yield* checkerOver(math.layer);
    assert.ok(Exit.isFailure(yield* Effect.exit(checker.check(13))));
    assert.equal(checker.snapshot.getSnapshot().failure?._tag, "CheckUnanswered");
    assert.deepEqual(yield* checker.check(13), { n: 13, prime: true, smallestFactor: 13 });
    assert.equal(checker.snapshot.getSnapshot().status, "result");
  }),
);
