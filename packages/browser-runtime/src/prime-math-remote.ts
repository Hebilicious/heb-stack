import { CheckOutputSchema, OutOfRangeSchema, PrimeMath } from "@heb-stack/acidcat/primes";
import type { PrimesApi } from "@heb-stack/rpc";
import { Effect, Layer, Schema } from "effect";

const CheckAnswerSchema = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), value: CheckOutputSchema }),
  Schema.Struct({ ok: Schema.Literal(false), error: OutOfRangeSchema }),
]);

/**
 * `PrimeMath` over the Worker: one capnweb batch per question, answered by the Worker's crate through `primes.check`.
 *
 * A remote answer that does not arrive is a defect here, because the arithmetic itself cannot fail: the owner's
 * lifecycle records the check as failed, and the page offers the same check again.
 */
export function primeMathRemoteLayer(endpoint: string): Layer.Layer<PrimeMath> {
  return Layer.succeed(
    PrimeMath,
    PrimeMath.of({
      smallestFactor: (n) =>
        n > BigInt(Number.MAX_SAFE_INTEGER)
          ? Effect.die(`${n} is beyond what the remote check carries`)
          : Effect.promise((signal) => remoteSmallestFactor(endpoint, Number(n), signal)),
    }),
  );
}

async function remoteSmallestFactor(endpoint: string, n: number, signal: AbortSignal): Promise<bigint> {
  const { newHttpBatchRpcSession } = await import("capnweb");
  const session = newHttpBatchRpcSession<PrimesApi>(
    new Request(endpoint, { method: "POST", credentials: "same-origin", signal }),
  );
  try {
    const answer = Schema.decodeUnknownSync(CheckAnswerSchema)(await session.check({ n }));
    if (!answer.ok) throw new RangeError(`The Worker refused ${n}: ${answer.error._tag}`);
    return BigInt(answer.value.smallestFactor);
  } finally {
    session[Symbol.dispose]();
  }
}
