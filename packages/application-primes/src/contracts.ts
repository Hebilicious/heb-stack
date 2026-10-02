import { Schema } from "effect";

/** The smallest number with a factor greater than one. */
export const SMALLEST_CHECKABLE = 2;
/** 2^53 − 1: every larger integer loses precision in a JSON number. */
export const LARGEST_CHECKABLE = Number.MAX_SAFE_INTEGER;
/** 2^53 − 111, the largest prime a JSON number carries exactly, so no `after` at or past it has an answer. */
export const LARGEST_SAFE_PRIME = 2 ** 53 - 111;
/** How many checks the history keeps, newest first. */
export const HISTORY_LIMIT = 20;

export const OutOfRangeSchema = Schema.TaggedStruct("OutOfRange", {
  n: Schema.Number,
  min: Schema.Number,
  max: Schema.Number,
});
export type OutOfRange = typeof OutOfRangeSchema.Type;

export const StorageUnavailableSchema = Schema.TaggedStruct("StorageUnavailable", { reason: Schema.String });
export type StorageUnavailable = typeof StorageUnavailableSchema.Type;

export const CheckInputSchema = Schema.Struct({
  n: Schema.Int.annotate({ description: `The integer to check, from ${SMALLEST_CHECKABLE} to 2^53 − 1.` }),
});
export type CheckInput = typeof CheckInputSchema.Type;

export const CheckOutputSchema = Schema.Struct({
  n: Schema.Int,
  prime: Schema.Boolean,
  smallestFactor: Schema.Int.annotate({
    description: "The smallest factor greater than one; n itself when n is prime.",
  }),
});
export type CheckOutput = typeof CheckOutputSchema.Type;

export const NextInputSchema = Schema.Struct({
  after: Schema.Int.annotate({ description: "The integer to search above, from 1 to 2^53 − 2." }),
});
export type NextInput = typeof NextInputSchema.Type;

export const NextOutputSchema = Schema.Struct({
  after: Schema.Int,
  prime: Schema.Int.annotate({ description: "The smallest prime greater than after." }),
});
export type NextOutput = typeof NextOutputSchema.Type;

export const HistoryEntrySchema = Schema.Struct({
  n: Schema.Int,
  prime: Schema.Boolean,
  checkedAt: Schema.String.annotate({ description: "When the check answered, as an ISO 8601 instant." }),
});
export type HistoryEntry = typeof HistoryEntrySchema.Type;

export const HistoryEntriesSchema = Schema.Array(HistoryEntrySchema).check(Schema.isMaxLength(HISTORY_LIMIT));

export const HistoryListOutputSchema = Schema.Struct({ entries: HistoryEntriesSchema });
export type HistoryListOutput = typeof HistoryListOutputSchema.Type;

export const HistoryClearOutputSchema = Schema.Struct({
  cleared: Schema.Int.annotate({ description: "How many entries the clear removed." }),
});
export type HistoryClearOutput = typeof HistoryClearOutputSchema.Type;

export const EmptyInputSchema = Schema.Struct({});

/** A capability that declares no failure answers with this schema, which no value satisfies. */
export const NoFailureSchema = Schema.Never;

/** The history a new entry produces: newest first, and never longer than the limit. */
export function withEntry(entries: readonly HistoryEntry[], entry: HistoryEntry): readonly HistoryEntry[] {
  return [entry, ...entries].slice(0, HISTORY_LIMIT);
}
