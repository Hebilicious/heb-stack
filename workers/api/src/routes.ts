import type { AcidCat } from "@heb-stack/acidcat";
import { createEdgeAcidCat } from "@heb-stack/edge-runtime";
import {
  MCP_HTTP_PATH,
  handleMcpHttpRequest,
  screenMcpHttpRequest,
} from "@heb-stack/mcp/http";
import type { McpServerIdentity } from "@heb-stack/mcp/http";
import { PRIMES_RPC_PATH } from "@heb-stack/rpc";
import { primesRpcResponse } from "@heb-stack/rpc/server";

import primesModule from "../../../crates/primes/target/wasm32-unknown-unknown/release/primes.wasm";

const MCP_IDENTITY: McpServerIdentity = {
  instructions:
    "These tools are the heb-stack prime checker served by a Worker session. The session keeps no caller state, so the check history is not available here; it belongs to the page and the command line.",
  name: "heb-stack",
  version: "0.1.0",
};

/** A binding the Worker reaches with an HTTP request, such as its assets. */
export interface HttpBinding {
  readonly fetch: (request: Request) => Promise<Response>;
}

/**
 * Answer one request: capnweb at `/rpc`, MCP at `/mcp`, and the built page for everything else. The crate is imported
 * here, not in the Worker's declaration, so Alchemy can load the declaration in Node while it plans.
 */
export async function serveRequest(
  request: Request,
  assets: HttpBinding
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === PRIMES_RPC_PATH) {
    return await withSession(
      "rpc",
      async (root) => await primesRpcResponse(request, url.origin, root.catalog)
    );
  }
  if (url.pathname === MCP_HTTP_PATH) {
    // A refused method or origin never needed the tools, so it is answered before a session opens.
    const refusal = screenMcpHttpRequest(request, [url.origin]);
    if (refusal !== null) {
      return refusal;
    }
    return await withSession(
      "mcp",
      async (root) =>
        await handleMcpHttpRequest(request, {
          allowedOrigins: [url.origin],
          catalog: root.catalog,
          identity: MCP_IDENTITY,
        })
    );
  }
  return await assets.fetch(request);
}

/**
 * One session per request: an Effect runtime built while handling one request holds cancellation objects that belong
 * to it, so a later request may not reuse it. The answer is complete before the session is disposed.
 */
async function withSession(
  target: "mcp" | "rpc",
  answer: (root: AcidCat) => Promise<Response>
): Promise<Response> {
  const root = await createEdgeAcidCat({ module: primesModule, target });
  try {
    return await answer(root);
  } finally {
    await root.dispose();
  }
}
