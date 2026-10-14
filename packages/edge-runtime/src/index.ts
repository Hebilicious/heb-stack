import { Mcp } from "@acid-cat/core-effect";
import { acidCatLayer, app, openAcidCat } from "@heb-stack/acidcat";
import type { AcidCatServices } from "@heb-stack/acidcat";
import { primeMathWasmLayer } from "@heb-stack/acidcat/primes";
import { primesRpcResponse } from "@heb-stack/rpc/server";
import { Effect, Layer } from "effect";

/** The one URL an MCP client posts to. */
export const MCP_HTTP_PATH = "/mcp";

/** What the MCP endpoint tells a client it is. */
export interface McpServerIdentity {
  readonly name: string;
  readonly version: string;
}

/** A request answered on its own: the shape every binding's web handler has. */
export type WebHandler = (request: Request) => Promise<Response>;

/**
 * The services of a Worker session: the crate, which workerd compiled once when the isolate started. An isolate serves
 * every caller, so a session keeps no history, and the history leaves, which neither tool target declares, are never
 * reachable here.
 */
export function edgeServices(module: WebAssembly.Module): AcidCatServices {
  return primeMathWasmLayer(module);
}

/**
 * Answer one request with services built for it alone and released once it is answered.
 *
 * Objects an isolate creates while it handles one request belong to that request, so a later request may not reuse
 * them; and one check lifecycle shared by concurrent callers would let each new check replace another caller's. The
 * handler receives the services already built, so it holds nothing it would have to release.
 */
export async function answerWithRequestServices<Services, Failure>(
  services: Layer.Layer<Services, Failure>,
  handlerFor: (built: Layer.Layer<Services>) => WebHandler,
  request: Request
): Promise<Response> {
  return await Effect.runPromise(
    Layer.build(services).pipe(
      Effect.flatMap((context) =>
        Effect.promise(
          async () => await handlerFor(Layer.succeedContext(context))(request)
        )
      ),
      Effect.scoped
    )
  );
}

export interface EdgeEndpointOptions {
  /** The crate, compiled by workerd once when the isolate starts. */
  readonly module: WebAssembly.Module;
  /** The Worker's own origin: the one origin a browser may call from. */
  readonly origin: string;
}

/** The MCP binding of `@acid-cat/core-effect`, serving the `mcp` target with one session per request. */
export async function edgeMcpResponse(
  request: Request,
  options: EdgeEndpointOptions & { readonly identity: McpServerIdentity }
): Promise<Response> {
  return await answerWithRequestServices(
    acidCatLayer(edgeServices(options.module)),
    (built) =>
      Mcp.toWebHandler(app, built, {
        allowedOrigins: [options.origin],
        name: options.identity.name,
        path: MCP_HTTP_PATH,
        target: "mcp",
        version: options.identity.version,
      }),
    request
  );
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
