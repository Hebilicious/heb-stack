# @heb-stack/edge-runtime

The Worker host: `createEdgeAcidCat({ target, module })` opens an `mcp` or `rpc` session over the crate workerd compiled once per isolate. An isolate serves every caller, so the session keeps no history.
