export interface SnapshotSubscription {
  readonly unsubscribe: () => void;
}

export interface ReadonlySnapshotSource<out Value> {
  readonly getSnapshot: () => Value;
  readonly subscribe: (
    listener: (value: Value) => void
  ) => SnapshotSubscription;
}

export type Availability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string };

export type AvailabilitySource = ReadonlySnapshotSource<Availability>;

/** What a source that never notifies hands a listener: there is nothing to release. */
const NO_SUBSCRIPTION: SnapshotSubscription = Object.freeze({
  unsubscribe: () => {
    // A constant source holds no listener.
  },
});

/** A source whose answer never changes, such as a capability that is always available to its audience. */
export function constantSource<Value>(
  value: Value
): ReadonlySnapshotSource<Value> {
  return Object.freeze({
    getSnapshot: () => value,
    subscribe: () => NO_SUBSCRIPTION,
  });
}

/** Each read and notification is detached from the canonical owner's storage. */
export function detachedSource<Value>(
  source: ReadonlySnapshotSource<Value>
): ReadonlySnapshotSource<Value> {
  return Object.freeze({
    getSnapshot: () => structuredClone(source.getSnapshot()),
    subscribe: (listener: (value: Value) => void) =>
      source.subscribe((value) => {
        listener(structuredClone(value));
      }),
  });
}
