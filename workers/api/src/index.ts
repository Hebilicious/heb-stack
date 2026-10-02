import type { AcidCat } from "@heb-stack/acidcat";
import { createEdgeAcidCat } from "@heb-stack/edge-runtime";
import { MCP_HTTP_PATH, handleMcpHttpRequest, screenMcpHttpRequest, type McpServerIdentity } from "@heb-stack/mcp/http";
import { PRIMES_RPC_PATH } from "@heb-stack/rpc";
import { primesRpcResponse } from "@heb-stack/rpc/server";
import primesModule from "../../../crates/primes/target/wasm32-unknown-unknown/release/primes.wasm";

const MCP_IDENTITY: McpServerIdentity = {
  name: "heb-stack",
  version: "0.1.0",
  instructions:
    "These tools are the heb-stack prime checker served by a Worker session. The session keeps no caller state, so the check history is not available here; it belongs to the page and the command line.",
};

export default {
  async fetch(request: Request, env: ApiWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === PRIMES_RPC_PATH)
      return withSession("rpc", (root) => primesRpcResponse(request, url.origin, root.catalog));
    if (url.pathname === MCP_HTTP_PATH) {
      // A refused method or origin never needed the tools, so it is answered before a session opens.
      const refusal = screenMcpHttpRequest(request, [url.origin]);
      if (refusal !== null) return refusal;
      return withSession("mcp", (root) =>
        handleMcpHttpRequest(request, { catalog: root.catalog, identity: MCP_IDENTITY, allowedOrigins: [url.origin] }),
      );
    }
    return env.ASSETS.fetch(request);
  },
};

/**
 * One session per request: an Effect runtime built while handling one request holds cancellation objects that belong
 * to it, so a later request may not reuse it. The answer is complete before the session is disposed.
 */
async function withSession(target: "mcp" | "rpc", answer: (root: AcidCat) => Promise<Response>): Promise<Response> {
  const root = await createEdgeAcidCat({ target, module: primesModule });
  try {
    return await answer(root);
  } finally {
    await root.dispose();
  }
}
