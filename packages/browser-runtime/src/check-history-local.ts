import { StorageUnavailableSchema, checkHistoryLayer, type CheckHistory } from "@heb-stack/acidcat/primes";
import { Effect, type Layer } from "effect";

/** The key the page keeps its checks under. */
export const CHECK_HISTORY_STORAGE_KEY = "heb-stack:check-history:v1";

/** The history in browser storage, which outlives a reload. */
export function checkHistoryLocalLayer(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): Layer.Layer<CheckHistory> {
  const unavailable = (cause: unknown) =>
    StorageUnavailableSchema.make({
      reason: cause instanceof Error ? cause.message : "Browser storage is unavailable",
    });
  return checkHistoryLayer({
    read: Effect.try({ try: () => storage.getItem(CHECK_HISTORY_STORAGE_KEY), catch: unavailable }),
    write: (text) => Effect.try({ try: () => storage.setItem(CHECK_HISTORY_STORAGE_KEY, text), catch: unavailable }),
    remove: Effect.try({ try: () => storage.removeItem(CHECK_HISTORY_STORAGE_KEY), catch: unavailable }),
  });
}
