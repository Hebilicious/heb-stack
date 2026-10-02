import assert from "node:assert/strict";
import { CheckOutputSchema } from "@heb-stack/acidcat/primes";
import { createEdgeAcidCat } from "@heb-stack/edge-runtime";
import { Effect, Schema } from "effect";
import { CallToolResultSchema, listedTools, mcpRequest } from "../support/mcp-client.ts";
import { compiledCrate, decode, scopedSession } from "../support/sessions.ts";
import { testEffect } from "../support/vitest-adapter.ts";

testEffect("an MCP client lists the Worker session's tools and calls primes.check", () =>
  Effect.gen(function* () {
    const module = yield* compiledCrate;
    const root = yield* scopedSession(() => createEdgeAcidCat({ target: "mcp", module }));

    const tools = yield* Effect.promise(() => listedTools(root.catalog));
    assert.deepEqual(tools, ["primes.check", "primes.next"]);

    const message = yield* Effect.promise(() =>
      mcpRequest(root.catalog, "tools/call", { name: "primes.check", arguments: { n: 91 } }, "primes.check"),
    );
    const result = decode(CallToolResultSchema, message.result);
    assert.notEqual(result.isError, true, result.content[0]?.text ?? "");
    const answer = decode(Schema.fromJsonString(CheckOutputSchema), result.content[0]?.text);
    assert.deepEqual(answer, { n: 91, prime: false, smallestFactor: 7 });
  }),
);
