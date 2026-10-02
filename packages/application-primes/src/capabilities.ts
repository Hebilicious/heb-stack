import { defineCapability } from "@heb-stack/acidcat-kernel";
import { Effect, Option } from "effect";
import {
  CheckInputSchema,
  CheckOutputSchema,
  EmptyInputSchema,
  HistoryClearOutputSchema,
  HistoryListOutputSchema,
  NextInputSchema,
  NextOutputSchema,
  NoFailureSchema,
  OutOfRangeSchema,
  StorageUnavailableSchema,
} from "./contracts.ts";
import { PrimeChecker } from "./checker.ts";
import { nextPrime } from "./computation.ts";
import { CheckHistory } from "./services.ts";

/** A history leaf reached in a session that keeps none was never declared for its target; that is a defect. */
const sessionHistory = Effect.serviceOption(CheckHistory).pipe(
  Effect.flatMap(
    Option.match({ onNone: () => Effect.die("This session keeps no check history"), onSome: Effect.succeed }),
  ),
);

export const checkDefinition = defineCapability({
  id: "primes.check",
  description:
    "Check whether an integer is prime, answering its smallest factor. A session that keeps a history records the check.",
  audience: ["web", "cli", "mcp", "rpc"],
  load: Effect.succeed({
    input: CheckInputSchema,
    output: CheckOutputSchema,
    error: OutOfRangeSchema,
    run: (input: typeof CheckInputSchema.Type) => PrimeChecker.use((checker) => checker.check(input.n)),
  }),
});

export const nextDefinition = defineCapability({
  id: "primes.next",
  description: "Find the smallest prime greater than an integer.",
  audience: ["web", "cli", "mcp", "rpc"],
  load: Effect.succeed({
    input: NextInputSchema,
    output: NextOutputSchema,
    error: OutOfRangeSchema,
    run: (input: typeof NextInputSchema.Type) => nextPrime(input.after),
  }),
});

export const historyListDefinition = defineCapability({
  id: "history.list",
  description: "List the last twenty checks, newest first.",
  audience: ["web", "cli"],
  load: Effect.succeed({
    input: EmptyInputSchema,
    output: HistoryListOutputSchema,
    error: NoFailureSchema,
    run: () =>
      sessionHistory.pipe(
        Effect.flatMap((history) => history.list),
        Effect.map((entries) => ({ entries })),
      ),
  }),
});

export const historyClearDefinition = defineCapability({
  id: "history.clear",
  description: "Remove every check from the history, answering how many there were.",
  audience: ["web", "cli"],
  load: Effect.succeed({
    input: EmptyInputSchema,
    output: HistoryClearOutputSchema,
    error: StorageUnavailableSchema,
    run: () =>
      sessionHistory.pipe(
        Effect.flatMap((history) => history.clear),
        Effect.map((cleared) => ({ cleared })),
      ),
  }),
});

/** The domain's capability tree, which the root composes into the one catalog. */
export const primeDefinitions = {
  primes: { check: checkDefinition, next: nextDefinition },
  history: { list: historyListDefinition, clear: historyClearDefinition },
};
