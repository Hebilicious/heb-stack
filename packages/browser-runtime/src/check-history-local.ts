import {
  StorageUnavailableSchema,
  checkHistoryLayer,
} from "@heb-stack/acidcat/primes";
import type { CheckHistory } from "@heb-stack/acidcat/primes";
import { Effect } from "effect";
import type { Layer } from "effect";

/** The key the page keeps its checks under. */
export const CHECK_HISTORY_STORAGE_KEY = "heb-stack:check-history:v1";

/** BOUNDARY: A storage call throws an unknown value; its message is all the failure keeps. */
function unavailable(cause: unknown) {
  return StorageUnavailableSchema.make({
    reason:
      cause instanceof Error ? cause.message : "Browser storage is unavailable",
  });
}

/** The history in browser storage, which outlives a reload. */
export function checkHistoryLocalLayer(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
): Layer.Layer<CheckHistory> {
  return checkHistoryLayer({
    read: Effect.try({
      catch: unavailable,
      try: () => storage.getItem(CHECK_HISTORY_STORAGE_KEY),
    }),
    remove: Effect.try({
      catch: unavailable,
      try: () => {
        storage.removeItem(CHECK_HISTORY_STORAGE_KEY);
      },
    }),
    write: (text) =>
      Effect.try({
        catch: unavailable,
        try: () => {
          storage.setItem(CHECK_HISTORY_STORAGE_KEY, text);
        },
      }),
  });
}
