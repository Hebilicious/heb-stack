import assert from "node:assert/strict";
import path from "node:path";

import { conform, serve } from "@acid-cat/cli";
import { Mcp } from "@acid-cat/core-effect";
import { AVAILABLE } from "@acid-cat/spec-ts";
import { openSession } from "@heb-stack/acidcat";
import { Effect, Layer, SubscriptionRef } from "effect";

import {
  fixture,
  fixtureLayer,
  Switch,
} from "../conformance/fixture.capabilities.ts";
import { Holds, makeHolds } from "../conformance/holds.ts";
import { testEffect } from "../support/vitest-adapter.ts";

/** The fixture as a command line, run the way `cli` runs. */
const FIXTURE_CLI = path.resolve(
  import.meta.dirname,
  "../conformance/fixture-cli.ts"
);

testEffect(
  "acid-cat conform passes against the MCP, CLI and WebMCP bindings as this repository hosts them",
  () =>
    Effect.gen(function* () {
      // One switch and one set of holds across requests, as one Worker deployment keeps them; everything else is built
      // per request.
      const on = yield* SubscriptionRef.make(AVAILABLE);
      const holds = yield* makeHolds();
      const perRequest = Layer.merge(
        Layer.succeed(Switch, on),
        Layer.succeed(Holds, holds)
      );
      const served = yield* Effect.acquireRelease(
        Effect.promise(
          async () =>
            await serve({
              // Services built for each request, as the Worker builds them.
              "/mcp": Mcp.toWebHandler(fixture, perRequest, {
                allowedOrigins: [],
                name: "fixture",
                services: "per-request",
                version: "0.0.0",
              }),
            })
        ),
        (server) =>
          Effect.promise(async () => {
            await server.close();
          })
      );
      const results = yield* Effect.promise(
        async () =>
          await conform({
            cli: [process.execPath, FIXTURE_CLI],
            mcp: `${served.url}/mcp`,
            webmcp: async (modelContext) => {
              const session = await openSession(fixture, fixtureLayer(), {
                target: "app",
                webmcp: modelContext,
              });
              return session.dispose;
            },
          })
      );
      const failed = results.filter((result) => !result.passed);
      assert.deepEqual(
        failed,
        [],
        failed
          .map(
            (result) =>
              `${result.binding}: ${result.name}: ${result.detail ?? ""}`
          )
          .join("\n")
      );
      for (const binding of ["mcp", "cli", "webmcp"]) {
        assert.ok(
          results.some((result) => result.binding === binding),
          `conform ran no check for ${binding}`
        );
      }
    })
);
