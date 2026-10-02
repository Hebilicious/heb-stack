import type { Catalog } from "@heb-stack/acidcat-kernel";
import { readAtMost } from "@heb-stack/acidcat-kernel/bounded-body";
import { Effect, Option, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

import { MAXIMUM_BODY_LENGTH } from "./path.ts";
import { mcpServerLayer } from "./server.ts";
import type { McpServerIdentity } from "./server.ts";
import { mcpToolkit, servedToolSources } from "./toolkit.ts";

export { MAXIMUM_BODY_LENGTH, MCP_HTTP_PATH } from "./path.ts";
export type { McpServerIdentity } from "./server.ts";

export interface McpHttpOptions {
  /** The scoped session this endpoint serves: its catalog is the tool surface. */
  readonly catalog: Catalog;
  readonly identity: McpServerIdentity;
  /**
   * Origins a browser may call from. The transport refuses every other cross-origin caller, which is what keeps a
   * page on another site from reaching this endpoint through a rebinding or a form post.
   */
  readonly allowedOrigins: readonly string[];
}

/**
 * The refusals decided from the request line alone. A host answers them before it opens anything a `503` would
 * otherwise mask, because origin and method are properties of the call rather than of the tools it reaches.
 */
export function screenMcpHttpRequest(
  request: Request,
  allowedOrigins: readonly string[]
): Response | null {
  const origin = request.headers.get("Origin");
  if (origin !== null && !allowedOrigins.includes(origin)) {
    return new Response("This MCP endpoint does not accept that origin", {
      headers: noStoreHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
      status: 403,
    });
  }
  if (request.method !== "POST") {
    return new Response("This MCP endpoint answers JSON-RPC over POST", {
      headers: noStoreHeaders({
        Allow: "POST",
        "Content-Type": "text/plain; charset=utf-8",
      }),
      status: 405,
    });
  }
  return null;
}

/**
 * Stateless Streamable HTTP, served by the Effect MCP server.
 *
 * The transport keeps the decisions a host owns: it screens the origin and the method from the request line, bounds
 * the message by the bytes that arrive, and reports `413` for a message it will not read. Everything after that,
 * which is the protocol itself, belongs to `effect/ai/McpServer`.
 */
export async function handleMcpHttpRequest(
  request: Request,
  options: McpHttpOptions
): Promise<Response> {
  const refusal = screenMcpHttpRequest(request, options.allowedOrigins);
  if (refusal !== null) {
    return refusal;
  }
  const body = await readBoundedBody(request);
  if (body === undefined) {
    return jsonRpcRefusal(413, -32_600, "The request body is too large");
  }
  // BOUNDARY: A client writes arbitrary bytes; the body is decoded as JSON before any protocol decoding, and a
  // body that is not JSON is a transport refusal rather than a protocol message.
  if (
    Option.isNone(
      Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Json))(body)
    )
  ) {
    return jsonRpcRefusal(400, -32_700, "The request body is not valid JSON");
  }
  const message = new Request(request.url, {
    body,
    headers: request.headers,
    method: "POST",
  });
  const sources = await Effect.runPromise(servedToolSources(options.catalog));
  const app = mcpServerLayer({
    identity: options.identity,
    origin: options.allowedOrigins[0] ?? "",
    tools: mcpToolkit(sources),
  });
  const response = await Effect.runPromise(
    Effect.gen(function* () {
      const handle = yield* HttpRouter.toHttpEffect(app);
      return yield* handle;
    }).pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(message)
      ),
      Effect.scoped
    )
  );
  return HttpServerResponse.toWeb(response);
}

/** One JSON-RPC refusal the transport itself decides, before any protocol message is decoded. */
interface JsonRpcRefusal {
  readonly jsonrpc: "2.0";
  readonly id: null;
  readonly error: { readonly code: number; readonly message: string };
}

function jsonRpcRefusal(
  status: number,
  code: number,
  message: string
): Response {
  const refusal: JsonRpcRefusal = {
    error: { code, message },
    id: null,
    jsonrpc: "2.0",
  };
  return Response.json(refusal, {
    headers: noStoreHeaders({
      "Content-Type": "application/json; charset=utf-8",
    }),
    status,
  });
}

function noStoreHeaders(headers: Record<string, string>): Headers {
  return new Headers({ ...headers, "Cache-Control": "no-store" });
}

/**
 * Read one JSON-RPC message bounded by the bytes that actually arrive. A declared `Content-Length` is only an early
 * refusal, because a caller may omit it or understate it: the streaming read counts real bytes, stops at the limit,
 * and cancels the stream instead of buffering a body it will not use.
 */
async function readBoundedBody(request: Request): Promise<string | undefined> {
  const declared = Number(request.headers.get("Content-Length") ?? "");
  if (Number.isFinite(declared) && declared > MAXIMUM_BODY_LENGTH) {
    return undefined;
  }
  if (request.body === null) {
    return "";
  }
  const bytes = await readAtMost(request.body, MAXIMUM_BODY_LENGTH);
  return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
}
