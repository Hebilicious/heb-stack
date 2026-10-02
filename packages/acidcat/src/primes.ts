/**
 * The prime domain's services, for the hosts that supply them. A host provides `PrimeMath` and, when it keeps one, a
 * `CheckHistory`; the domain's owners stay inside the root.
 */
export {
  CheckHistory,
  PrimeMath,
  checkHistoryLayer,
  primeMathWasmLayer,
  type CheckSnapshot,
  type HistoryText,
} from "@heb-stack/application-primes/runtime";
export {
  CheckOutputSchema,
  HISTORY_LIMIT,
  NextOutputSchema,
  OutOfRangeSchema,
  HistoryEntriesSchema,
  StorageUnavailableSchema,
  withEntry,
  type CheckOutput,
  type HistoryEntry,
  type NextOutput,
  type OutOfRange,
  type StorageUnavailable,
} from "@heb-stack/application-primes/contracts";
