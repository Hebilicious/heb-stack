import type { ReadonlySnapshotSource } from "@heb-stack/acidcat-kernel";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import { Context, Effect, Layer, Predicate, Schema } from "effect";
import type { SnapshotFrom } from "xstate";
import { CheckOutputSchema, type CheckOutput, type OutOfRange } from "./contracts.ts";
import { CheckFailureSchema, checkMachine } from "./check-machine.ts";
import type { PrimeMath } from "./services.ts";

export const CheckSnapshotSchema = Schema.Struct({
  status: Schema.Literals(["idle", "checking", "result", "failed"]),
  n: Schema.NullOr(Schema.Int),
  answer: Schema.NullOr(CheckOutputSchema),
  failure: Schema.NullOr(CheckFailureSchema),
});
/** What the page renders: the lifecycle's state and the number it concerns, detached from the actor. */
export type CheckSnapshot = typeof CheckSnapshotSchema.Type;

/** The owner of the check lifecycle: one actor per session, read through its snapshot and driven by `check`. */
export class PrimeChecker extends Context.Service<
  PrimeChecker,
  {
    readonly snapshot: ReadonlySnapshotSource<CheckSnapshot>;
    /**
     * Check `n` and await this call's own answer. A call made after a failure of the same number retries it. A newer
     * call replaces this one, which then ends interrupted rather than answering for a number nobody is waiting on.
     */
    readonly check: (n: number) => Effect.Effect<CheckOutput, OutOfRange>;
  }
>()("@heb-stack/application-primes/PrimeChecker") {}

function project(snapshot: SnapshotFrom<typeof checkMachine>): CheckSnapshot {
  const status = snapshot.matches("checking")
    ? "checking"
    : snapshot.matches("result")
      ? "result"
      : snapshot.matches("failed")
        ? "failed"
        : "idle";
  const { n, answer, failure } = snapshot.context;
  return { status, n: status === "idle" ? null : n, answer, failure };
}

export const primeCheckerLayer: Layer.Layer<PrimeChecker, never, PrimeMath> = Layer.effect(
  PrimeChecker,
  Effect.gen(function* () {
    const actor = yield* createEffectActor(checkMachine);
    let issued = 0;
    const check = Effect.fn("PrimeChecker.check")(function* (n: number) {
      issued += 1;
      const ticket = issued;
      const current = actor.getSnapshot();
      const retrying = current.matches("failed") && current.context.n === n;
      yield* send(actor, retrying ? { type: "RETRY", ticket } : { type: "CHECK", ticket, n });
      const settled = yield* waitFor(
        actor,
        (snapshot) =>
          snapshot.context.ticket > ticket ||
          (snapshot.context.ticket === ticket && (snapshot.matches("result") || snapshot.matches("failed"))),
      ).pipe(Effect.catchTag("ActorStoppedError", () => Effect.interrupt));
      if (settled.context.ticket !== ticket) return yield* Effect.interrupt;
      const { answer, failure } = settled.context;
      if (answer !== null) return answer;
      if (Predicate.isTagged(failure, "OutOfRange")) return yield* Effect.fail(failure);
      return yield* Effect.die(failure?.reason ?? "The check settled without an answer");
    });
    return PrimeChecker.of({
      snapshot: {
        getSnapshot: () => project(actor.getSnapshot()),
        subscribe: (listener) => actor.subscribe((snapshot) => listener(project(snapshot))),
      },
      check,
    });
  }),
);
