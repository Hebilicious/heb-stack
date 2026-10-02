import { Context, type Effect } from "effect";
import type { HistoryEntry, StorageUnavailable } from "./contracts.ts";

/** Integer arithmetic over the full 64-bit range, which is why it speaks `bigint`. */
export class PrimeMath extends Context.Service<
  PrimeMath,
  {
    /** The smallest factor of `n` greater than one; `n` itself when `n` is prime. */
    readonly smallestFactor: (n: bigint) => Effect.Effect<bigint>;
  }
>()("@heb-stack/application-primes/PrimeMath") {}

/** Where a session keeps its checks: at most twenty, newest first. */
export class CheckHistory extends Context.Service<
  CheckHistory,
  {
    readonly append: (entry: HistoryEntry) => Effect.Effect<void, StorageUnavailable>;
    readonly list: Effect.Effect<readonly HistoryEntry[]>;
    /** Remove every entry and answer how many there were. */
    readonly clear: Effect.Effect<number, StorageUnavailable>;
  }
>()("@heb-stack/application-primes/CheckHistory") {}
