import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/ai";
import { MCP_HTTP_PATH } from "./path.ts";
import { type McpToolkit } from "./toolkit.ts";

/** What the endpoint tells a client it is. */
export interface McpServerIdentity {
  readonly name: string;
  readonly version: string;
  readonly instructions: string;
}

/**
 * The MCP server, over the stateless protocol revision.
 *
 * The 2026-07-28 revision carries everything a request needs in the request itself, so a Worker isolate can answer
 * it without a session. The earlier revisions keep server-side session state, which an isolate that serves one
 * request at a time cannot hold.
 */
export function mcpServerLayer(options: {
  readonly origin: string;
  readonly identity: McpServerIdentity;
  readonly tools: McpToolkit;
}) {
  return Layer.mergeAll(
    McpServer.layerHttp({
      name: options.identity.name,
      version: options.identity.version,
      instructions: options.identity.instructions,
      path: MCP_HTTP_PATH,
      protocols: [McpProtocol.v2026_07_28],
      allowedOrigins: [options.origin],
    }),
    McpServer.toolkit(options.tools.toolkit),
  ).pipe(Layer.provide(options.tools.handlers));
}
