import { createEffectActor, send, waitFor } from "@xstate/effect";
import {
  Context,
  Effect,
  Layer,
  Predicate,
  Queue,
  Schema,
  Stream,
} from "effect";
import type { SnapshotFrom } from "xstate";

import { CheckFailureSchema, checkMachine } from "./check-machine.ts";
import { CheckOutputSchema } from "./contracts.ts";
import type { CheckOutput, OutOfRange } from "./contracts.ts";
import type { PrimeMath } from "./prime-math.ts";

export const CheckSnapshotSchema = Schema.Struct({
  answer: Schema.NullOr(CheckOutputSchema),
  failure: Schema.NullOr(CheckFailureSchema),
  n: Schema.NullOr(Schema.Int),
  status: Schema.Literals(["idle", "checking", "result", "failed"]),
});
/** What the page renders: the lifecycle's state and the number it concerns, detached from the actor. */
export type CheckSnapshot = typeof CheckSnapshotSchema.Type;

/** The owner of the check lifecycle: one actor per session, observed through its snapshots and driven by `check`. */
export class PrimeChecker extends Context.Service<
  PrimeChecker,
  {
    /** The lifecycle now. */
    readonly current: Effect.Effect<CheckSnapshot>;
    /** The lifecycle now, then every change to it. */
    readonly changes: Stream.Stream<CheckSnapshot>;
    /**
     * Check `n` and await this call's own answer. A call made after a failure of the same number retries it. A newer
     * call replaces this one, which then ends interrupted rather than answering for a number nobody is waiting on.
     */
    readonly check: (n: number) => Effect.Effect<CheckOutput, OutOfRange>;
  }
>()("@heb-stack/primes/PrimeChecker") {}

/** The states a page distinguishes, in the order a snapshot is matched against them. */
const STATUSES = ["checking", "result", "failed"] as const;

function project(snapshot: SnapshotFrom<typeof checkMachine>): CheckSnapshot {
  const status =
    STATUSES.find((candidate) => snapshot.matches(candidate)) ?? "idle";
  const { n, answer, failure } = snapshot.context;
  return { answer, failure, n: status === "idle" ? null : n, status };
}

export const primeCheckerLayer: Layer.Layer<PrimeChecker, never, PrimeMath> =
  Layer.effect(
    PrimeChecker,
    Effect.gen(function* () {
      const actor = yield* createEffectActor(checkMachine);
      let issued = 0;
      const check = Effect.fn("PrimeChecker.check")(function* (n: number) {
        issued += 1;
        const ticket = issued;
        const current = actor.getSnapshot();
        const retrying = current.matches("failed") && current.context.n === n;
        yield* send(
          actor,
          retrying ? { ticket, type: "RETRY" } : { n, ticket, type: "CHECK" }
        );
        const settled = yield* waitFor(
          actor,
          (snapshot) =>
            snapshot.context.ticket > ticket ||
            (snapshot.context.ticket === ticket &&
              (snapshot.matches("result") || snapshot.matches("failed")))
        ).pipe(Effect.catchTag("ActorStoppedError", () => Effect.interrupt));
        if (settled.context.ticket !== ticket) {
          return yield* Effect.interrupt;
        }
        const { answer, failure } = settled.context;
        if (answer !== null) {
          return answer;
        }
        if (Predicate.isTagged(failure, "OutOfRange")) {
          return yield* Effect.fail(failure);
        }
        return yield* Effect.die(
          failure?.reason ?? "The check settled without an answer"
        );
      });
      const changes = Stream.callback<CheckSnapshot>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            Queue.offerUnsafe(queue, project(actor.getSnapshot()));
            return actor.subscribe((snapshot) => {
              Queue.offerUnsafe(queue, project(snapshot));
            });
          }),
          (subscription) =>
            Effect.sync(() => {
              subscription.unsubscribe();
            })
        )
      );
      return PrimeChecker.of({
        changes,
        check,
        current: Effect.sync(() => project(actor.getSnapshot())),
      });
    })
  );
