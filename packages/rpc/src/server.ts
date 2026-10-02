import { servedCapabilities } from "@heb-stack/acidcat-kernel";
import type { Catalog, Result } from "@heb-stack/acidcat-kernel";
import { readAtMost } from "@heb-stack/acidcat-kernel/bounded-body";
import { RpcTarget, newHttpBatchRpcResponse } from "capnweb";

import { PRIMES_RPC_LIMITS } from "./api.ts";
import type { PrimesApi } from "./api.ts";

/**
 * The API over one `rpc` session's catalog. A method names its capability, so a leaf this target does not serve is
 * refused by name exactly as every other adapter refuses it, and a capability's own failure answers as its `Result`.
 */
class PrimesRpcTarget extends RpcTarget implements PrimesApi {
  readonly #catalog: Catalog;

  constructor(catalog: Catalog) {
    super();
    this.#catalog = catalog;
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
    return servedCapabilities(this.#catalog, "rpc").map((leaf) => leaf.id);
  }

  // BOUNDARY: The caller's input is untrusted; the capability decodes it with its canonical schema.
  async #invoke(id: string, input: unknown): Promise<Result<unknown, unknown>> {
    const leaf = servedCapabilities(this.#catalog, "rpc").find(
      (candidate) => candidate.id === id
    );
    if (leaf === undefined) {
      throw new Error(`Unknown capability: ${id}`);
    }
    return await leaf.invokeExternal(input);
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
  catalog: Catalog
): Promise<Response> {
  const rejection = rpcRequestRejection(request, expectedOrigin);
  if (rejection !== null) {
    return rejection;
  }
  const bounded = await boundedRpcRequest(
    request,
    PRIMES_RPC_LIMITS.maxMessageSize
  );
  if (bounded === null) {
    return new Response("Request too large", { status: 413 });
  }
  return await newHttpBatchRpcResponse(bounded, new PrimesRpcTarget(catalog), {
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

/** The request with its body read up to `maximumBytes`, or null when the body is larger. */
async function boundedRpcRequest(
  request: Request,
  maximumBytes: number
): Promise<Request | null> {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && Number(declared) > maximumBytes) {
    return null;
  }
  if (request.body === null) {
    return new Request(request.url, request);
  }
  const bytes = await readAtMost(request.body, maximumBytes);
  if (bytes === undefined) {
    return null;
  }
  const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return new Request(request.url, {
    body,
    headers: request.headers,
    method: "POST",
  });
}
