import { servedCapabilities, type Catalog, type Result } from "@heb-stack/acidcat-kernel";
import { RpcTarget, newHttpBatchRpcResponse } from "capnweb";
import { PRIMES_RPC_LIMITS, type PrimesApi } from "./api.ts";

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
  check(input: unknown): Promise<Result<unknown, unknown>> {
    return this.#invoke("primes.check", input);
  }

  // BOUNDARY: The caller's input is untrusted; the capability decodes it with its canonical schema.
  next(input: unknown): Promise<Result<unknown, unknown>> {
    return this.#invoke("primes.next", input);
  }

  capabilities(): readonly string[] {
    return servedCapabilities(this.#catalog, "rpc").map((leaf) => leaf.id);
  }

  // BOUNDARY: The caller's input is untrusted; the capability decodes it with its canonical schema.
  #invoke(id: string, input: unknown): Promise<Result<unknown, unknown>> {
    const leaf = servedCapabilities(this.#catalog, "rpc").find((candidate) => candidate.id === id);
    if (leaf === undefined) return Promise.reject(new Error(`Unknown capability: ${id}`));
    return leaf.invokeExternal(input);
  }
}

/**
 * Answer one capnweb batch, or refuse the request before reading it.
 *
 * capnweb's own batch handler accepts cross-origin requests, so the origin is checked here first, and the body is
 * bounded before capnweb reads it because its message limit applies to each line rather than to the batch.
 */
export async function primesRpcResponse(request: Request, expectedOrigin: string, catalog: Catalog): Promise<Response> {
  const rejection = rpcRequestRejection(request, expectedOrigin);
  if (rejection !== null) return rejection;
  const bounded = await boundedRpcRequest(request, PRIMES_RPC_LIMITS.maxMessageSize);
  if (bounded === null) return new Response("Request too large", { status: 413 });
  return newHttpBatchRpcResponse(bounded, new PrimesRpcTarget(catalog), {
    limits: PRIMES_RPC_LIMITS,
    onSendError: () => new Error("RPC request failed"),
  });
}

function supportsRpcContentType(value: string | null): boolean {
  if (value === null) return false;
  const [mediaType, ...parameters] = value.split(";").map((part) => part.trim().toLowerCase());
  if (mediaType !== "text/plain" || parameters.length > 1) return false;
  return parameters.length === 0 || parameters[0] === "charset=utf-8";
}

/** Why a request may not be answered as RPC, or null when it may. */
export function rpcRequestRejection(request: Request, expectedOrigin: string): Response | null {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  if (request.headers.has("Upgrade")) return new Response("Upgrade not supported", { status: 426 });
  if (request.headers.get("Origin") !== expectedOrigin) return new Response("Forbidden", { status: 403 });
  if (!supportsRpcContentType(request.headers.get("Content-Type")))
    return new Response("Unsupported media type", { status: 415 });
  return null;
}

/** The request with its body read up to `maximumBytes`, or null when the body is larger. */
async function boundedRpcRequest(request: Request, maximumBytes: number): Promise<Request | null> {
  const declared = request.headers.get("Content-Length");
  if (declared !== null && Number(declared) > maximumBytes) return null;
  if (request.body === null) return new Request(request.url, request);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return new Request(request.url, { method: "POST", headers: request.headers, body });
}
