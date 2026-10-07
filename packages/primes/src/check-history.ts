import { Context } from "effect";
import type { Effect } from "effect";

import type { HistoryEntry, StorageUnavailable } from "./contracts.ts";

/** Where a session keeps its checks: at most twenty, newest first. */
export class CheckHistory extends Context.Service<
  CheckHistory,
  {
    readonly append: (
      entry: HistoryEntry
    ) => Effect.Effect<void, StorageUnavailable>;
    readonly list: Effect.Effect<readonly HistoryEntry[]>;
    /** Remove every entry and answer how many there were. */
    readonly clear: Effect.Effect<number, StorageUnavailable>;
  }
>()("@heb-stack/primes/CheckHistory") {}
