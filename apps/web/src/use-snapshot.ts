import { Atom, useAtomValue } from "@effect/atom-vue";
import type { ReadonlySnapshotSource } from "@heb-stack/acidcat";

/** An atom that observes the existing owner and releases only its subscription. */
export function useSnapshot<Value>(source: ReadonlySnapshotSource<Value>) {
  const atom = Atom.make((context) => {
    const subscription = source.subscribe((value) => {
      context.setSelf(value);
    });
    context.addFinalizer(() => {
      subscription.unsubscribe();
    });
    return source.getSnapshot();
  });
  return useAtomValue(() => atom);
}
