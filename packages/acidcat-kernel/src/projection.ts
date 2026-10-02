export interface SnapshotSubscription {
  unsubscribe(): void;
}

export interface ReadonlySnapshotSource<out Value> {
  getSnapshot(): Value;
  subscribe(listener: (value: Value) => void): SnapshotSubscription;
}

export type Availability = { readonly available: true } | { readonly available: false; readonly reason: string };

export type AvailabilitySource = ReadonlySnapshotSource<Availability>;

/** A source whose answer never changes, such as a capability that is always available to its audience. */
export function constantSource<Value>(value: Value): ReadonlySnapshotSource<Value> {
  return Object.freeze({ getSnapshot: () => value, subscribe: () => ({ unsubscribe: () => undefined }) });
}

/** Each read and notification is detached from the canonical owner's storage. */
export function detachedSource<Value>(source: ReadonlySnapshotSource<Value>): ReadonlySnapshotSource<Value> {
  return Object.freeze({
    getSnapshot: () => structuredClone(source.getSnapshot()),
    subscribe: (listener: (value: Value) => void) => source.subscribe((value) => listener(structuredClone(value))),
  });
}
