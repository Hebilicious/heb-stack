/** The holds of the conformance fixture: calls to `fixture.hold` that wait until `fixture.release` lets them go. */
import { Context, Deferred, Effect } from "effect";

/** The calls to `fixture.hold` that hold now, shared by every session of one host. */
export class Holds extends Context.Service<
  Holds,
  {
    /** Hold until `release` releases the key; with a marker, mark that the hold began. An interruption ends it. */
    readonly held: Effect.Effect<readonly string[]>;
    readonly hold: (
      key: string,
      marker: string | undefined
    ) => Effect.Effect<void>;
    readonly release: (key: string) => Effect.Effect<void>;
  }
>()("@heb-stack/features/conformance/Holds") {}

interface Hold {
  readonly key: string;
  readonly released: Deferred.Deferred<null>;
}

/**
 * The holds of one host. `mark` writes a marker file, which only the command line gives: each of its calls is its own
 * process, so the checks learn that a hold began from the file rather than from `fixture.held`.
 */
export const makeHolds = (mark?: (path: string) => Effect.Effect<void>) =>
  Effect.sync(() => {
    const holding = new Set<Hold>();
    return Holds.of({
      held: Effect.sync(() => [...holding].map((entry) => entry.key)),
      hold: (key, marker) =>
        Effect.acquireUseRelease(
          Effect.map(Deferred.make<null>(), (released) => {
            const entry = { key, released };
            holding.add(entry);
            return entry;
          }),
          (entry) =>
            Effect.andThen(
              marker === undefined || mark === undefined
                ? Effect.void
                : mark(marker),
              Deferred.await(entry.released)
            ),
          (entry) =>
            Effect.sync(() => {
              holding.delete(entry);
            })
        ),
      release: (key) =>
        Effect.forEach(
          [...holding].filter((entry) => entry.key === key),
          (entry) => Deferred.succeed(entry.released, null),
          { discard: true }
        ),
    });
  });
