# @heb-stack/mcp

The Model Context Protocol endpoint: `effect/ai/McpServer` over stateless HTTP (revision `2026-07-28`), mounted at `/mcp` on the Worker. The tools are the `mcp` session's served leaves, each with its capability's input schema; a leaf the target does not declare is absent from `tools/list` and refused by name. `handleMcpHttpRequest` screens origin, method and body size before any protocol work.
