import * as Cloudflare from "alchemy/Cloudflare";

/** The API Worker: the built page, capnweb at `/rpc`, and MCP at `/mcp`. It exposes no Workers RPC methods. */
export class Api extends Cloudflare.Worker<Api, Record<never, never>>()(
  "Api"
) {}
