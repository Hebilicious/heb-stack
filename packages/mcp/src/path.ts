/** The one endpoint a Streamable HTTP client posts to. */
export const MCP_HTTP_PATH = "/mcp";

/**
 * One JSON-RPC message is small; a larger body is refused before it is decoded. Exported so evidence can size a
 * message against the bound a transport actually enforces instead of restating it.
 */
export const MAXIMUM_BODY_LENGTH = 1_048_576;
