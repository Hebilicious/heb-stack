import type { Handles } from "@acid-cat/core-effect";
import { readBounded } from "@acid-cat/spec-ts";
import type { Result } from "@acid-cat/spec-ts";
import { RpcTarget, newHttpBatchRpcResponse } from "capnweb";

import { PRIMES_RPC_LIMITS } from "./api.ts";
import type { PrimesApi } from "./api.ts";

/** The handles of one `rpc` session, by id: the capabilities this API may reach. */
export type RpcHandles = ReadonlyMap<string, Handles.Handle>;

/**
 * The API over one `rpc` session's handles. A method names its capability, so a leaf this target does not serve is
 * refused by name exactly as every other binding refuses it, and a capability's own failure answers as its `Result`.
 */
class PrimesRpcTarget extends RpcTarget implements PrimesApi {
  readonly #handles: RpcHandles;

  constructor(handles: RpcHandles) {
    super();
    this.#handles = handles;
  }

  // BOUNDARY: The caller's input is untrusted; the capability decodes it with its canonical schema.
  async check(input: unknown): Promise<Result<unknown, unknown>> {
    return await this.#invoke("primes.check", input);
  }

  // BOUNDARY: The caller's input is untrusted; the capability decodes it with its canonical schema.
  async next(input: unknown): Promise<Result<unknown, unknown>> {
    return await this.#invoke("primes.next", input);
  }

  capabilities(): readonly string[] {
    return [...this.#handles.values()]
      .filter((handle) => handle.availability.getSnapshot().available)
      .map((handle) => handle.id);
  }

  // BOUNDARY: The caller's input is untrusted; the capability decodes it with its canonical schema.
  async #invoke(id: string, input: unknown): Promise<Result<unknown, unknown>> {
    const handle = this.#handles.get(id);
    if (handle === undefined) {
      throw new Error(`Unknown capability: ${id}`);
    }
    return await handle.invokeExternal(input);
  }
}

/**
 * Answer one capnweb batch, or refuse the request before reading it.
 *
 * capnweb's own batch handler accepts cross-origin requests, so the origin is checked here first, and the body is
 * bounded before capnweb reads it because its message limit applies to each line rather than to the batch.
 */
export async function primesRpcResponse(
  request: Request,
  expectedOrigin: string,
  handles: RpcHandles
): Promise<Response> {
  const rejection = rpcRequestRejection(request, expectedOrigin);
  if (rejection !== null) {
    return rejection;
  }
  const bounded = await boundedRpcRequest(request);
  if (bounded instanceof Response) {
    return bounded;
  }
  return await newHttpBatchRpcResponse(bounded, new PrimesRpcTarget(handles), {
    limits: PRIMES_RPC_LIMITS,
    onSendError: () => new Error("RPC request failed"),
  });
}

function supportsRpcContentType(value: string | null): boolean {
  if (value === null) {
    return false;
  }
  const [mediaType, ...parameters] = value
    .split(";")
    .map((part) => part.trim().toLowerCase());
  if (mediaType !== "text/plain" || parameters.length > 1) {
    return false;
  }
  return parameters.length === 0 || parameters[0] === "charset=utf-8";
}

/** Why a request may not be answered as RPC, or null when it may. */
export function rpcRequestRejection(
  request: Request,
  expectedOrigin: string
): Response | null {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      headers: { Allow: "POST" },
      status: 405,
    });
  }
  if (request.headers.has("Upgrade")) {
    return new Response("Upgrade not supported", { status: 426 });
  }
  if (request.headers.get("Origin") !== expectedOrigin) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!supportsRpcContentType(request.headers.get("Content-Type"))) {
    return new Response("Unsupported media type", { status: 415 });
  }
  return null;
}

/**
 * The request with its body read up to the batch limit, or the refusal for a body that is larger or is not UTF-8.
 * BOUNDARY: A client writes arbitrary bytes; they become the batch's text only when they decode as UTF-8.
 */
async function boundedRpcRequest(
  request: Request
): Promise<Request | Response> {
  const declared = request.headers.get("Content-Length");
  if (
    declared !== null &&
    Number(declared) > PRIMES_RPC_LIMITS.maxMessageSize
  ) {
    return new Response("Request too large", { status: 413 });
  }
  const body = await readBounded(request, PRIMES_RPC_LIMITS.maxMessageSize);
  if ("rejection" in body) {
    return body.rejection === "too-large"
      ? new Response("Request too large", { status: 413 })
      : new Response("The request body is not UTF-8", { status: 400 });
  }
  return new Request(request.url, {
    body: body.text,
    headers: request.headers,
    method: "POST",
  });
}
