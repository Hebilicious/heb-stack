import { fromEffect, setupEffect } from "@xstate/effect";
import { Option, Schema } from "effect";
import { standardSchemaValidator } from "xstate/validation";
import { CheckOutputSchema, OutOfRangeSchema } from "./contracts.ts";
import { checkNumber } from "./computation.ts";

/** A check that ended without an answer: the service behind it failed, so the same check may be retried. */
export const CheckUnansweredSchema = Schema.TaggedStruct("CheckUnanswered", { reason: Schema.String });

export const CheckFailureSchema = Schema.Union([OutOfRangeSchema, CheckUnansweredSchema]);
export type CheckFailure = typeof CheckFailureSchema.Type;

/**
 * `ticket` names the request the context belongs to. The owner issues one per call, in the order it sends them, so a
 * caller recognises its own settlement and learns that a newer request replaced it.
 */
const CheckContextSchema = Schema.Struct({
  ticket: Schema.Int,
  n: Schema.Int,
  answer: Schema.NullOr(CheckOutputSchema),
  failure: Schema.NullOr(CheckFailureSchema),
});

/** BOUNDARY: An invoked Effect actor fails with its typed failure or a squashed defect, which arrive as `unknown`. */
function checkFailure(error: unknown): CheckFailure {
  return Option.getOrElse(Schema.decodeUnknownOption(OutOfRangeSchema)(error), () =>
    CheckUnansweredSchema.make({ reason: error instanceof Error ? error.message : "The check did not answer." }),
  );
}

/**
 * The check lifecycle: `idle → checking → result | failed`. A new number re-enters `checking`, which stops the check
 * in flight and interrupts its Effect; `RETRY` from `failed` checks the same number again.
 */
export const checkMachine = setupEffect({
  validator: standardSchemaValidator(),
  schemas: {
    context: CheckContextSchema,
    events: {
      CHECK: Schema.Struct({ ticket: Schema.Int, n: Schema.Int }),
      RETRY: Schema.Struct({ ticket: Schema.Int }),
    },
  },
  actors: {
    check: fromEffect({
      schemas: { input: Schema.Struct({ n: Schema.Int }), output: CheckOutputSchema },
      effect: ({ input }) => checkNumber(input.n),
    }),
  },
}).createMachine({
  id: "check",
  initial: "idle",
  // `n` is 0 until the first check; nothing reads it in `idle`.
  context: { ticket: 0, n: 0, answer: null, failure: null },
  on: {
    CHECK: {
      target: ".checking",
      reenter: true,
      context: ({ event }) => ({ ticket: event.ticket, n: event.n, answer: null, failure: null }),
    },
  },
  states: {
    idle: {},
    checking: {
      invoke: {
        src: "check",
        input: ({ context }) => ({ n: context.n }),
        onDone: { target: "result", context: ({ event }) => ({ answer: event.output }) },
        onError: { target: "failed", context: ({ event }) => ({ failure: checkFailure(event.error) }) },
      },
    },
    result: {},
    failed: {
      on: {
        RETRY: { target: "checking", context: ({ event }) => ({ ticket: event.ticket, failure: null }) },
      },
    },
  },
});
