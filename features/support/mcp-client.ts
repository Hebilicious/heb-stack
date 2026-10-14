import { edgeMcpResponse } from "@heb-stack/edge-runtime";
import { Schema } from "effect";

import { decode } from "./sessions.ts";

/** The origin evidence addresses an endpoint from. */
export const ORIGIN = "https://heb-stack.example.test";

/** An endpoint that answers one request: what the Worker routes `/mcp` to. */
export type McpEndpoint = (request: Request) => Promise<Response>;

/** The revision that carries everything a request needs, which is the one a stateless endpoint serves. */
const PROTOCOL_VERSION = "2026-07-28";
const REQUEST_METADATA = {
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
};

export const WireMessageSchema = Schema.Struct({
  error: Schema.optionalKey(
    Schema.Struct({ code: Schema.Number, message: Schema.String })
  ),
  id: Schema.optionalKey(
    Schema.Union([Schema.String, Schema.Number, Schema.Null])
  ),
  jsonrpc: Schema.Literal("2.0"),
  result: Schema.optionalKey(Schema.Json),
});
const ToolsResultSchema = Schema.Struct({
  tools: Schema.Array(Schema.Struct({ name: Schema.String })),
});
export const CallToolResultSchema = Schema.Struct({
  content: Schema.Array(
    Schema.Struct({ text: Schema.String, type: Schema.Literal("text") })
  ),
  isError: Schema.optionalKey(Schema.Boolean),
  structuredContent: Schema.optionalKey(Schema.Json),
});

/** One stateless MCP request to an endpoint, decoded as a JSON-RPC message. */
export async function mcpRequest(
  endpoint: McpEndpoint,
  method: "tools/list" | "tools/call",
  params: Readonly<Record<string, typeof Schema.Json.Type>>,
  name?: string
): Promise<typeof WireMessageSchema.Type> {
  const headers = new Headers({
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "mcp-method": method,
    "mcp-protocol-version": PROTOCOL_VERSION,
  });
  if (name !== undefined) {
    headers.set("mcp-name", name);
  }
  const response = await endpoint(
    new Request(`${ORIGIN}/mcp`, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method,
        params: { ...params, _meta: REQUEST_METADATA },
      }),
      headers,
      method: "POST",
    })
  );
  if (response.status !== 200) {
    throw new Error(`The endpoint answered ${String(response.status)}`);
  }
  const body: unknown = await response.json();
  return decode(WireMessageSchema, body);
}

/** The tool names an MCP client sees, sorted. */
export async function listedTools(
  endpoint: McpEndpoint
): Promise<readonly string[]> {
  const message = await mcpRequest(endpoint, "tools/list", {});
  if (message.error !== undefined) {
    throw new Error(message.error.message);
  }
  return decode(ToolsResultSchema, message.result)
    .tools.map((tool) => tool.name)
    .toSorted((left, right) => left.localeCompare(right));
}

/** The Worker's own MCP endpoint over the compiled crate, as `/mcp` answers it. */
export function workerMcpEndpoint(module: WebAssembly.Module): McpEndpoint {
  return async (request) =>
    await edgeMcpResponse(request, {
      identity: { name: "evidence", version: "0.0.0" },
      module,
      origin: ORIGIN,
    });
}
