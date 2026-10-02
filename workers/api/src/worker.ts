import * as Cloudflare from "alchemy/Cloudflare";
import { Stack } from "alchemy/Stack";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Predicate from "effect/Predicate";

import { Api } from "./contract.ts";
import type { HttpBinding } from "./routes.ts";

/** The built page; `moon run web:build` writes it. */
const PAGE_DIRECTORY = decodeURIComponent(
  new URL("../../../apps/web/dist", import.meta.url).pathname
);

/** BOUNDARY: The Worker environment is untyped; the assets binding is checked to be an HTTP service before use. */
function assetsBinding(env: unknown): HttpBinding {
  const binding: unknown = Predicate.hasProperty(env, "ASSETS")
    ? env.ASSETS
    : undefined;
  if (
    !Predicate.hasProperty(binding, "fetch") ||
    !Predicate.isFunction(binding.fetch)
  ) {
    throw new TypeError("The Worker has no ASSETS binding.");
  }
  const { fetch } = binding;
  return {
    fetch: async (request) => {
      const response: unknown = await fetch.call(binding, request);
      if (!(response instanceof Response)) {
        throw new TypeError(
          "The ASSETS binding answered something other than a Response."
        );
      }
      return response;
    },
  };
}

/**
 * The API Worker: the built page as assets, capnweb at `/rpc`, and MCP at `/mcp`. It names itself after the stage, so
 * every stage is its own Worker and no stage replaces another.
 */
export default Api.make(
  Stack.useSync(({ stage }) => ({
    assets: {
      directory: PAGE_DIRECTORY,
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/rpc", "/mcp"],
    },
    compatibility: { date: "2026-09-25" },
    // `alchemy dev` serves the Worker on this port; the browser test chooses a free one.
    dev: { port: Number(process.env.HEB_STACK_PORT ?? "1337") },
    main: import.meta.url,
    name: `heb-stack-${stage}`,
    workersDev: { enabled: true, previewsEnabled: false },
  })),
  Effect.gen(function* () {
    // Loaded on the first request, so planning a deploy never evaluates the crate import.
    const routes = yield* Effect.cached(
      Effect.promise(async () => await import("./routes.ts"))
    );
    return {
      fetch: Effect.gen(function* () {
        const request = yield* Cloudflare.Request;
        const env = yield* Cloudflare.Workers.WorkerEnvironment;
        const { serveRequest } = yield* routes;
        const response = yield* Effect.promise(
          async () => await serveRequest(request, assetsBinding(env))
        );
        return HttpServerResponse.fromWeb(response);
      }),
    };
  })
);
