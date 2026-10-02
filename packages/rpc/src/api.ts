import type { Result } from "@heb-stack/acidcat-kernel";

/** Where a client reaches the API. The Worker routes this path and the browser posts to it. */
export const PRIMES_RPC_PATH = "/rpc";

/**
 * The batch limits the endpoint enforces. A call carries one small JSON object, so a few kibibytes bound a batch of
 * them, and the Worker applies `maxMessageSize` to the whole body before capnweb reads it.
 */
export const PRIMES_RPC_LIMITS = {
  maxBigIntDigits: 32,
  maxDepth: 16,
  maxMessageSize: 16 * 1024,
} as const;

/**
 * The capnweb surface of the `rpc` target. Each method is one capability, invoked through the catalog with the
 * caller's input, so its answer is that capability's wire `Result`: a client decodes it with the capability's schema.
 */
export interface PrimesApi {
  /** `primes.check`. BOUNDARY: The caller's input is untrusted until the capability decodes it. */
  readonly check: (input: unknown) => Promise<Result<unknown, unknown>>;
  /** `primes.next`. BOUNDARY: The caller's input is untrusted until the capability decodes it. */
  readonly next: (input: unknown) => Promise<Result<unknown, unknown>>;
  /** The capability IDs this target serves. */
  readonly capabilities: () => readonly string[];
}
