/** The watchers of the conformance fixture: subscriptions to `fixture.watch` that `fixture.signal` gives occurrences. */
import { Context, Effect, PubSub, Stream } from "effect";

import type { Marker } from "./marker.ts";

/** The subscriptions to `fixture.watch` that are active now, shared by every session of one host. */
export class Watchers extends Context.Service<
  Watchers,
  {
    /** Give each occurrence `signal` sends to the key. With a marker, mark the subscription while it lasts. */
    readonly watch: (
      key: string,
      marker: string | undefined
    ) => Stream.Stream<string>;
    readonly watching: Effect.Effect<readonly string[]>;
    /** Give the value to each subscription that watches the key, and answer how many those are. */
    readonly signal: (key: string, value: string) => Effect.Effect<number>;
  }
>()("@heb-stack/features/conformance/Watchers") {}

interface Signal {
  readonly key: string;
  readonly value: string;
}

interface Watch {
  readonly key: string;
}

/** The watchers of one host. With a marker, a subscription writes its marker file when it starts and removes it when it ends. */
export const makeWatchers = (marker?: Marker) =>
  Effect.gen(function* () {
    const signals = yield* PubSub.unbounded<Signal>();
    const watching = new Set<Watch>();
    return Watchers.of({
      signal: (key, value) =>
        Effect.as(
          PubSub.publish(signals, { key, value }),
          [...watching].filter((entry) => entry.key === key).length
        ),
      watch: (key, path) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const subscription = yield* PubSub.subscribe(signals);
            const entry = { key };
            yield* Effect.acquireRelease(
              Effect.sync(() => {
                watching.add(entry);
              }),
              () =>
                Effect.sync(() => {
                  watching.delete(entry);
                })
            );
            if (path !== undefined && marker !== undefined) {
              yield* Effect.acquireRelease(marker.write(path), () =>
                marker.remove(path)
              );
            }
            return Stream.fromSubscription(subscription).pipe(
              Stream.filter((signal) => signal.key === key),
              Stream.map((signal) => signal.value)
            );
          })
        ),
      watching: Effect.sync(() => [...watching].map((entry) => entry.key)),
    });
  });
