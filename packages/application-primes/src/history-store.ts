import { Effect, Layer, Schema } from "effect";
import { HistoryEntriesSchema, withEntry, type HistoryEntry, type StorageUnavailable } from "./contracts.ts";
import { CheckHistory } from "./services.ts";

/** One stored document, as a host keeps it: browser storage, a file, or anything else that holds text. */
export interface HistoryText {
  readonly read: Effect.Effect<string | null, StorageUnavailable>;
  readonly write: (text: string) => Effect.Effect<void, StorageUnavailable>;
  readonly remove: Effect.Effect<void, StorageUnavailable>;
}

const StoredHistorySchema = Schema.fromJsonString(HistoryEntriesSchema);

/**
 * The one history rule, over whatever text store a host has: twenty entries, newest first.
 *
 * A stored document that does not decode is not a history this session wrote, so reading it is a defect rather than
 * an empty list; clearing it still removes it.
 */
export function checkHistoryLayer(text: HistoryText): Layer.Layer<CheckHistory> {
  const decode = (stored: string | null): Effect.Effect<readonly HistoryEntry[]> =>
    stored === null
      ? Effect.succeed([])
      : Schema.decodeUnknownEffect(StoredHistorySchema)(stored).pipe(
          Effect.catch(() => Effect.die("The stored check history is not one this application wrote")),
        );
  const entries = text.read.pipe(Effect.flatMap(decode));
  return Layer.succeed(
    CheckHistory,
    CheckHistory.of({
      append: (entry) =>
        entries.pipe(
          Effect.flatMap((current) => Schema.encodeEffect(StoredHistorySchema)(withEntry(current, entry))),
          Effect.orDie,
          Effect.flatMap(text.write),
        ),
      list: entries.pipe(Effect.orDie),
      clear: text.read.pipe(
        Effect.flatMap((stored) => decode(stored).pipe(Effect.catchDefect(() => Effect.succeed([])))),
        Effect.tap(() => text.remove),
        Effect.map((removed) => removed.length),
      ),
    }),
  );
}
