# @heb-stack/edge-runtime

The Worker host. `edgeServices(module)` is a session's services over the crate workerd compiled once per isolate; an isolate serves every caller, so a session keeps no history.

Each request gets its own session, with services built for it and released once it is answered (`answerWithRequestServices`): `edgeMcpResponse` serves the `mcp` target with the MCP binding of `@acid-cat/core-effect`, and `edgeRpcResponse` serves the `rpc` target with the capnweb API.
