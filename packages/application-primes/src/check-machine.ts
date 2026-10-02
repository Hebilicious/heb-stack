import { fromEffect, setupEffect } from "@xstate/effect";
import { Option, Schema } from "effect";
import { standardSchemaValidator } from "xstate/validation";

import { checkNumber } from "./computation.ts";
import { CheckOutputSchema, OutOfRangeSchema } from "./contracts.ts";

/** A check that ended without an answer: the service behind it failed, so the same check may be retried. */
export const CheckUnansweredSchema = Schema.TaggedStruct("CheckUnanswered", {
  reason: Schema.String,
});

export const CheckFailureSchema = Schema.Union([
  OutOfRangeSchema,
  CheckUnansweredSchema,
]);
export type CheckFailure = typeof CheckFailureSchema.Type;

/**
 * `ticket` names the request the context belongs to. The owner issues one per call, in the order it sends them, so a
 * caller recognises its own settlement and learns that a newer request replaced it.
 */
const CheckContextSchema = Schema.Struct({
  answer: Schema.NullOr(CheckOutputSchema),
  failure: Schema.NullOr(CheckFailureSchema),
  n: Schema.Int,
  ticket: Schema.Int,
});

/** BOUNDARY: An invoked Effect actor fails with its typed failure or a squashed defect, which arrive as `unknown`. */
function checkFailure(error: unknown): CheckFailure {
  return Option.getOrElse(
    Schema.decodeUnknownOption(OutOfRangeSchema)(error),
    () =>
      CheckUnansweredSchema.make({
        reason:
          error instanceof Error ? error.message : "The check did not answer.",
      })
  );
}

/**
 * The check lifecycle: `idle → checking → result | failed`. A new number re-enters `checking`, which stops the check
 * in flight and interrupts its Effect; `RETRY` from `failed` checks the same number again.
 */
export const checkMachine = setupEffect({
  actors: {
    check: fromEffect({
      effect: ({ input }) => checkNumber(input.n),
      schemas: {
        input: Schema.Struct({ n: Schema.Int }),
        output: CheckOutputSchema,
      },
    }),
  },
  schemas: {
    context: CheckContextSchema,
    events: {
      CHECK: Schema.Struct({ n: Schema.Int, ticket: Schema.Int }),
      RETRY: Schema.Struct({ ticket: Schema.Int }),
    },
  },
  validator: standardSchemaValidator(),
}).createMachine({
  // `n` is 0 until the first check; nothing reads it in `idle`.
  context: { answer: null, failure: null, n: 0, ticket: 0 },
  id: "check",
  initial: "idle",
  on: {
    CHECK: {
      context: ({ event }) => ({
        answer: null,
        failure: null,
        n: event.n,
        ticket: event.ticket,
      }),
      reenter: true,
      target: ".checking",
    },
  },
  states: {
    checking: {
      invoke: {
        input: ({ context }) => ({ n: context.n }),
        onDone: {
          context: ({ event }) => ({ answer: event.output }),
          target: "result",
        },
        onError: {
          context: ({ event }) => ({ failure: checkFailure(event.error) }),
          target: "failed",
        },
        src: "check",
      },
    },
    failed: {
      on: {
        RETRY: {
          context: ({ event }) => ({ failure: null, ticket: event.ticket }),
          target: "checking",
        },
      },
    },
    idle: {},
    result: {},
  },
});
