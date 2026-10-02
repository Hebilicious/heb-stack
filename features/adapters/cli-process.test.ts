import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CheckOutputSchema, HistoryEntriesSchema } from "@heb-stack/acidcat/primes";
import { Effect, Schema } from "effect";
import { decodeAdapterAnswer, requireBuiltAdapter, runBuiltAdapter } from "../support/adapter-process.ts";
import { testEffect } from "../support/vitest-adapter.ts";

/** The one bundled entry point `moon run app:cli-build` writes. */
const CLI_ENTRY = ".artifacts/cli/main.js";

testEffect("the built command line checks a number and records it in the history file it was given", () =>
  Effect.gen(function* () {
    yield* Effect.promise(() => requireBuiltAdapter(CLI_ENTRY, "cli-build"));
    const directory = yield* Effect.acquireRelease(
      Effect.promise(() => mkdtemp(join(tmpdir(), "heb-stack-cli-"))),
      (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
    );
    const history = join(directory, "history.json");

    const check = yield* Effect.promise(() =>
      runBuiltAdapter(CLI_ENTRY, "call", "primes.check", '{"n":97}', "--json", "--history", history),
    );
    assert.equal(check.status, 0, check.stderr);
    assert.deepEqual(decodeAdapterAnswer(CheckOutputSchema, check.stdout), { n: 97, prime: true, smallestFactor: 97 });

    const listed = yield* Effect.promise(() =>
      runBuiltAdapter(CLI_ENTRY, "call", "history.list", "{}", "--json", "--history", history),
    );
    assert.equal(listed.status, 0, listed.stderr);
    const { entries } = decodeAdapterAnswer(Schema.Struct({ entries: HistoryEntriesSchema }), listed.stdout);
    assert.deepEqual(
      entries.map((entry) => [entry.n, entry.prime]),
      [[97, true]],
    );

    const refused = yield* Effect.promise(() =>
      runBuiltAdapter(CLI_ENTRY, "call", "primes.check", '{"n":1}', "--json", "--history", history),
    );
    assert.equal(refused.status, 1, "A capability's own failure exits 1");
    assert.match(refused.stdout, /"OutOfRange"/u);
  }),
);
