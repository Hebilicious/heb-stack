import {
  MCP_HTTP_PATH,
  edgeMcpResponse,
  edgeRpcResponse,
} from "@heb-stack/edge-runtime";
import { PRIMES_RPC_PATH } from "@heb-stack/rpc";

import primesModule from "../../../crates/primes/target/wasm32-unknown-unknown/release/primes.wasm";

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
  const { origin, pathname } = new URL(request.url);
  if (pathname === PRIMES_RPC_PATH) {
    return await edgeRpcResponse(request, { module: primesModule, origin });
  }
  if (pathname === MCP_HTTP_PATH) {
    return await edgeMcpResponse(request, {
      identity: { name: "heb-stack", version: "0.1.0" },
      module: primesModule,
      origin,
    });
  }
  return await assets.fetch(request);
}
