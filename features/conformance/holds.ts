/** The holds of the conformance fixture: calls to `fixture.hold` that wait until `fixture.release` lets them go. */
import { Context, Deferred, Effect } from "effect";

import type { Marker } from "./marker.ts";

/** The calls to `fixture.hold` that hold now, shared by every session of one host. */
export class Holds extends Context.Service<
  Holds,
  {
    readonly held: Effect.Effect<readonly string[]>;
    /** Hold until `release` releases the key; with a marker, mark the hold while it lasts. An interruption ends it. */
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

/** The holds of one host. With a marker, a hold writes its marker file when it begins and removes it when it ends. */
export const makeHolds = (marker?: Marker) =>
  Effect.sync(() => {
    const holding = new Set<Hold>();
    return Holds.of({
      held: Effect.sync(() => [...holding].map((entry) => entry.key)),
      hold: (key, path) =>
        Effect.acquireUseRelease(
          Effect.map(Deferred.make<null>(), (released) => {
            const entry = { key, released };
            holding.add(entry);
            return entry;
          }),
          (entry) =>
            Effect.andThen(
              path === undefined || marker === undefined
                ? Effect.void
                : marker.write(path),
              Deferred.await(entry.released)
            ),
          (entry) =>
            Effect.andThen(
              Effect.sync(() => {
                holding.delete(entry);
              }),
              path === undefined || marker === undefined
                ? Effect.void
                : marker.remove(path)
            )
        ),
      release: (key) =>
        Effect.forEach(
          [...holding].filter((entry) => entry.key === key),
          (entry) => Deferred.succeed(entry.released, null),
          { discard: true }
        ),
    });
  });
