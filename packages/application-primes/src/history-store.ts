import { Effect, Layer, Schema } from "effect";

import { CheckHistory } from "./check-history.ts";
import { HistoryEntriesSchema, withEntry } from "./contracts.ts";
import type { HistoryEntry, StorageUnavailable } from "./contracts.ts";

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
function decode(stored: string | null): Effect.Effect<readonly HistoryEntry[]> {
  return stored === null
    ? Effect.succeed([])
    : Schema.decodeUnknownEffect(StoredHistorySchema)(stored).pipe(
        Effect.catchTag("SchemaError", () =>
          Effect.die(
            "The stored check history is not one this application wrote"
          )
        )
      );
}

export function checkHistoryLayer(
  text: HistoryText
): Layer.Layer<CheckHistory> {
  const entries = text.read.pipe(Effect.flatMap(decode));
  return Layer.succeed(
    CheckHistory,
    CheckHistory.of({
      append: (entry) =>
        entries.pipe(
          Effect.flatMap((current) =>
            Schema.encodeEffect(StoredHistorySchema)(withEntry(current, entry))
          ),
          Effect.orDie,
          Effect.flatMap(text.write)
        ),
      clear: text.read.pipe(
        Effect.flatMap((stored) =>
          decode(stored).pipe(Effect.catchDefect(() => Effect.succeed([])))
        ),
        Effect.tap(() => text.remove),
        Effect.map((removed) => removed.length)
      ),
      list: entries.pipe(Effect.orDie),
    })
  );
}
