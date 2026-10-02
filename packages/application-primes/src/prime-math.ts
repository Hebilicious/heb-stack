import { Context } from "effect";
import type { Effect } from "effect";

/** Integer arithmetic over the full 64-bit range, which is why it speaks `bigint`. */
export class PrimeMath extends Context.Service<
  PrimeMath,
  {
    /** The smallest factor of `n` greater than one; `n` itself when `n` is prime. */
    readonly smallestFactor: (n: bigint) => Effect.Effect<bigint>;
  }
>()("@heb-stack/application-primes/PrimeMath") {}
