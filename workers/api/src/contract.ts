import * as Cloudflare from "@alchemy.run/cloudflare";

/** The API Worker: the built page, capnweb at `/rpc`, and MCP at `/mcp`. It exposes no Workers RPC methods. */
export class Api extends Cloudflare.Worker<
  Api,
  // oxlint-disable-next-line typescript/no-generated-empty-object-type -- the Worker's RPC methods, of which it has none
  Record<never, never>
>()("Api") {}
