import { Mcp } from "@acid-cat/core-effect";
import { acidCatLayer, app, openAcidCat } from "@heb-stack/acidcat";
import type { AcidCatServices } from "@heb-stack/acidcat";
import { primeMathWasmLayer } from "@heb-stack/acidcat/primes";
import { primesRpcResponse } from "@heb-stack/rpc/server";

/** The one URL an MCP client posts to. */
export const MCP_HTTP_PATH = "/mcp";

/** What the MCP endpoint tells a client it is, and how a model should use it. */
export interface McpServerIdentity {
  readonly name: string;
  readonly version: string;
  /** Guidance for a model about the whole server. Without it, the description of the application. */
  readonly instructions?: string;
}

/** The Worker's MCP endpoint: its sessions keep no caller state, so the model is told where the history lives. */
export const WORKER_MCP_IDENTITY: McpServerIdentity = {
  instructions:
    "These tools are the heb-stack prime checker served by a Worker session. The session keeps no caller state, so the check history is not available here; it belongs to the page and the command line.",
  name: "heb-stack",
  version: "0.1.0",
};

/**
 * The services of a Worker session: the crate, which workerd compiled once when the isolate started. An isolate serves
 * every caller, so a session keeps no history, and the history leaves, which neither tool target declares, are never
 * reachable here.
 */
export function edgeServices(module: WebAssembly.Module): AcidCatServices {
  return primeMathWasmLayer(module);
}

export interface EdgeEndpointOptions {
  /** The crate, compiled by workerd once when the isolate starts. */
  readonly module: WebAssembly.Module;
  /** The Worker's own origin: the one origin a browser may call from. */
  readonly origin: string;
}

/**
 * The MCP binding of `@acid-cat/core-effect`, serving the `mcp` target with one session per request.
 *
 * Its services are built for each request and released once it is answered: objects an isolate creates while it
 * handles one request belong to that request, so a later request may not reuse them, and one check lifecycle shared by
 * concurrent callers would let each new check replace another caller's.
 */
export async function edgeMcpResponse(
  request: Request,
  options: EdgeEndpointOptions & { readonly identity: McpServerIdentity }
): Promise<Response> {
  return await Mcp.toWebHandler(
    app,
    acidCatLayer(edgeServices(options.module)),
    {
      allowedOrigins: [options.origin],
      instructions: options.identity.instructions,
      name: options.identity.name,
      path: MCP_HTTP_PATH,
      services: "per-request",
      target: "mcp",
      version: options.identity.version,
    }
  )(request);
}

/** The capnweb API, serving the `rpc` target with one session per request. */
export async function edgeRpcResponse(
  request: Request,
  options: EdgeEndpointOptions
): Promise<Response> {
  const root = await openAcidCat(edgeServices(options.module), {
    target: "rpc",
  });
  try {
    return await primesRpcResponse(request, options.origin, root.handles);
  } finally {
    await root.dispose();
  }
}
