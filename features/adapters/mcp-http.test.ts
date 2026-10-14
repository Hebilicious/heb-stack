import assert from "node:assert/strict";

import { CheckOutputSchema } from "@heb-stack/acidcat/primes";
import { WORKER_MCP_IDENTITY } from "@heb-stack/edge-runtime";
import { Effect, Schema } from "effect";

import {
  CallToolResultSchema,
  listedTools,
  mcpRequest,
  workerMcpEndpoint,
} from "../support/mcp-client.ts";
import { compiledCrate, decode } from "../support/sessions.ts";
import { testEffect } from "../support/vitest-adapter.ts";

/** The part of `server/discover` this proof reads. */
const DiscoverResultSchema = Schema.Struct({
  instructions: Schema.optionalKey(Schema.String),
});

testEffect(
  "an MCP client reads the Worker's instructions, lists its tools and calls primes.check",
  () =>
    Effect.gen(function* () {
      const endpoint = workerMcpEndpoint(yield* compiledCrate);

      const discovered = yield* Effect.promise(
        async () => await mcpRequest(endpoint, "server/discover", {})
      );
      assert.equal(
        decode(DiscoverResultSchema, discovered.result).instructions,
        WORKER_MCP_IDENTITY.instructions,
        "The Worker tells a model that the history is not served here"
      );

      const tools = yield* Effect.promise(
        async () => await listedTools(endpoint)
      );
      assert.deepEqual(tools, ["primes.check", "primes.next"]);

      const message = yield* Effect.promise(
        async () =>
          await mcpRequest(
            endpoint,
            "tools/call",
            { arguments: { n: 91 }, name: "primes.check" },
            "primes.check"
          )
      );
      const result = decode(CallToolResultSchema, message.result);
      assert.notEqual(result.isError, true, result.content[0]?.text ?? "");
      const answer = decode(
        Schema.fromJsonString(CheckOutputSchema),
        result.content[0]?.text
      );
      assert.deepEqual(answer, { n: 91, prime: false, smallestFactor: 7 });
      assert.deepEqual(result.structuredContent, answer);
    })
);
