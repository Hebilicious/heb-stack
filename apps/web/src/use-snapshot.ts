import { Atom, useAtomValue } from "@effect/atom-vue";
import type { Handles } from "@heb-stack/acidcat";

/** An atom that observes the existing owner and releases only its subscription. */
export function useSnapshot<Value>(source: Handles.Observable<Value>) {
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
