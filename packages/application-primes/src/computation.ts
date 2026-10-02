import { DateTime, Effect, Option } from "effect";

import { CheckHistory } from "./check-history.ts";
import {
  LARGEST_CHECKABLE,
  LARGEST_SAFE_PRIME,
  OutOfRangeSchema,
  SMALLEST_CHECKABLE,
} from "./contracts.ts";
import type { CheckOutput, NextOutput, OutOfRange } from "./contracts.ts";
import { PrimeMath } from "./prime-math.ts";

/** Check one number, and record the answer when this session keeps a history. */
export const checkNumber = Effect.fn("checkNumber")(function* (
  n: number
): Effect.fn.Return<CheckOutput, OutOfRange, PrimeMath> {
  if (n < SMALLEST_CHECKABLE || n > LARGEST_CHECKABLE) {
    return yield* Effect.fail(
      OutOfRangeSchema.make({
        max: LARGEST_CHECKABLE,
        min: SMALLEST_CHECKABLE,
        n,
      })
    );
  }
  const math = yield* PrimeMath;
  const factor = yield* math.smallestFactor(BigInt(n));
  const answer: CheckOutput = {
    n,
    prime: factor === BigInt(n),
    smallestFactor: Number(factor),
  };
  const history = yield* Effect.serviceOption(CheckHistory);
  if (Option.isSome(history)) {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    // The answer does not depend on the history: a store that refuses the entry is reported, not returned.
    yield* history.value
      .append({ checkedAt, n, prime: answer.prime })
      .pipe(
        Effect.catchTag("StorageUnavailable", (failure) =>
          Effect.logWarning(
            `The check history could not record ${n}: ${failure.reason}`
          )
        )
      );
  }
  return answer;
});

/** The smallest prime above `after`, by asking the same service a check asks, one candidate at a time. */
export const nextPrime = Effect.fn("nextPrime")(function* (
  after: number
): Effect.fn.Return<NextOutput, OutOfRange, PrimeMath> {
  const largestAfter = LARGEST_SAFE_PRIME - 1;
  if (after < 1 || after > largestAfter) {
    return yield* Effect.fail(
      OutOfRangeSchema.make({ max: largestAfter, min: 1, n: after })
    );
  }
  const math = yield* PrimeMath;
  let candidate = BigInt(after) + 1n;
  while ((yield* math.smallestFactor(candidate)) !== candidate) {
    candidate += 1n;
  }
  return { after, prime: Number(candidate) };
});
