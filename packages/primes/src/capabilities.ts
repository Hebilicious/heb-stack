import { Capability } from "@acid-cat/core-effect";
import { Effect, Option, Stream } from "effect";

import { CheckHistory } from "./check-history.ts";
import { CheckSnapshotSchema, PrimeChecker } from "./checker.ts";
import { nextPrime } from "./computation.ts";
import {
  CheckInputSchema,
  CheckOutputSchema,
  HISTORY_LIMIT,
  HistoryClearOutputSchema,
  HistoryListOutputSchema,
  NextInputSchema,
  NextOutputSchema,
  OutOfRangeSchema,
  StorageUnavailableSchema,
} from "./contracts.ts";

/** A history leaf reached in a session that keeps none was never declared for its target; that is a defect. */
const sessionHistory = Effect.serviceOption(CheckHistory).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.die("This session keeps no check history"),
      onSome: Effect.succeed,
    })
  )
);

export const checkCapability = Capability.make({
  audience: ["web", "cli", "mcp", "rpc"],
  description:
    "Check whether an integer is prime, answering its smallest factor. A session that keeps a history records the check.",
  failures: [OutOfRangeSchema],
  id: "primes.check",
  input: CheckInputSchema,
  output: CheckOutputSchema,
  readOnly: true,
  run: (input) => PrimeChecker.use((checker) => checker.check(input.n)),
  // The check lifecycle, which the page renders: the check in flight, its answer, or why it failed.
  state: {
    changes: Stream.unwrap(
      PrimeChecker.use((checker) => Effect.succeed(checker.changes))
    ),
    schema: CheckSnapshotSchema,
  },
});

export const nextCapability = Capability.make({
  audience: ["web", "cli", "mcp", "rpc"],
  description: "Find the smallest prime greater than an integer.",
  failures: [OutOfRangeSchema],
  id: "primes.next",
  input: NextInputSchema,
  output: NextOutputSchema,
  readOnly: true,
  run: (input) => nextPrime(input.after),
});

export const historyListCapability = Capability.make({
  audience: ["web", "cli"],
  description: `List the checks in the history, newest first. The history holds the ${String(HISTORY_LIMIT)} newest checks.`,
  id: "primes.history.list",
  output: HistoryListOutputSchema,
  readOnly: true,
  run: () =>
    sessionHistory.pipe(
      Effect.flatMap((history) => history.list),
      Effect.map((entries) => ({ entries }))
    ),
});

export const historyClearCapability = Capability.make({
  audience: ["web", "cli"],
  description:
    "Remove every check from the history, answering how many there were.",
  failures: [StorageUnavailableSchema],
  id: "primes.history.clear",
  output: HistoryClearOutputSchema,
  run: () =>
    sessionHistory.pipe(
      Effect.flatMap((history) => history.clear),
      Effect.map((cleared) => ({ cleared }))
    ),
});

/** The `primes` namespace: the one namespace this catalog defines, which the root composes as it is. */
export const primeCapabilities = [
  checkCapability,
  nextCapability,
  historyListCapability,
  historyClearCapability,
] as const;
