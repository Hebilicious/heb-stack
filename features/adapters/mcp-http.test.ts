import assert from "node:assert/strict";

import { CheckOutputSchema } from "@heb-stack/acidcat/primes";
import { createEdgeAcidCat } from "@heb-stack/edge-runtime";
import { Effect, Schema } from "effect";

import {
  CallToolResultSchema,
  listedTools,
  mcpRequest,
} from "../support/mcp-client.ts";
import { compiledCrate, decode, scopedSession } from "../support/sessions.ts";
import { testEffect } from "../support/vitest-adapter.ts";

testEffect(
  "an MCP client lists the Worker session's tools and calls primes.check",
  () =>
    Effect.gen(function* () {
      const module = yield* compiledCrate;
      const root = yield* scopedSession(
        async () => await createEdgeAcidCat({ module, target: "mcp" })
      );

      const tools = yield* Effect.promise(
        async () => await listedTools(root.catalog)
      );
      assert.deepEqual(tools, ["primes.check", "primes.next"]);

      const message = yield* Effect.promise(
        async () =>
          await mcpRequest(
            root.catalog,
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
    })
);
