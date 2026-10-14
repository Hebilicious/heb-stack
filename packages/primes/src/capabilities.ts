import { defineCapability } from "@heb-stack/acidcat-kernel";
import { Effect, Option } from "effect";

import { CheckHistory } from "./check-history.ts";
import { PrimeChecker } from "./checker.ts";
import { nextPrime } from "./computation.ts";
import {
  CheckInputSchema,
  CheckOutputSchema,
  EmptyInputSchema,
  HISTORY_LIMIT,
  HistoryClearOutputSchema,
  HistoryListOutputSchema,
  NextInputSchema,
  NextOutputSchema,
  NoFailureSchema,
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

export const checkDefinition = defineCapability({
  audience: ["web", "cli", "mcp", "rpc"],
  description:
    "Check whether an integer is prime, answering its smallest factor. A session that keeps a history records the check.",
  id: "primes.check",
  load: Effect.succeed({
    error: OutOfRangeSchema,
    input: CheckInputSchema,
    output: CheckOutputSchema,
    run: (input: typeof CheckInputSchema.Type) =>
      PrimeChecker.use((checker) => checker.check(input.n)),
  }),
  readOnly: true,
});

export const nextDefinition = defineCapability({
  audience: ["web", "cli", "mcp", "rpc"],
  description: "Find the smallest prime greater than an integer.",
  id: "primes.next",
  load: Effect.succeed({
    error: OutOfRangeSchema,
    input: NextInputSchema,
    output: NextOutputSchema,
    run: (input: typeof NextInputSchema.Type) => nextPrime(input.after),
  }),
  readOnly: true,
});

export const historyListDefinition = defineCapability({
  audience: ["web", "cli"],
  description: `List the checks in the history, newest first. The history holds the ${String(HISTORY_LIMIT)} newest checks.`,
  id: "primes.history.list",
  load: Effect.succeed({
    error: NoFailureSchema,
    input: EmptyInputSchema,
    output: HistoryListOutputSchema,
    run: () =>
      sessionHistory.pipe(
        Effect.flatMap((history) => history.list),
        Effect.map((entries) => ({ entries }))
      ),
  }),
  readOnly: true,
});

export const historyClearDefinition = defineCapability({
  audience: ["web", "cli"],
  description:
    "Remove every check from the history, answering how many there were.",
  id: "primes.history.clear",
  load: Effect.succeed({
    error: StorageUnavailableSchema,
    input: EmptyInputSchema,
    output: HistoryClearOutputSchema,
    run: () =>
      sessionHistory.pipe(
        Effect.flatMap((history) => history.clear),
        Effect.map((cleared) => ({ cleared }))
      ),
  }),
});

/** The `primes` namespace: the one namespace this catalog defines, which the root composes as it is. */
export const primeDefinitions = {
  primes: {
    check: checkDefinition,
    history: { clear: historyClearDefinition, list: historyListDefinition },
    next: nextDefinition,
  },
};
