import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CheckOutputSchema,
  HistoryEntriesSchema,
} from "@heb-stack/acidcat/primes";
import { Effect, Schema } from "effect";

import {
  decodeAdapterAnswer,
  requireBuiltAdapter,
  runBuiltAdapter,
} from "../support/adapter-process.ts";
import { REPOSITORY_ROOT } from "../support/sessions.ts";
import { testEffect } from "../support/vitest-adapter.ts";

/** The one bundled entry point `moon run cli:build` writes. */
const CLI_ENTRY = path.resolve(REPOSITORY_ROOT, ".artifacts/cli/main.js");

testEffect(
  "cli checks a number through its derived command, records it, and answers a typed failure as JSON",
  () =>
    Effect.gen(function* () {
      yield* Effect.promise(async () => {
        await requireBuiltAdapter(CLI_ENTRY, "cli:build");
      });
      const directory = yield* Effect.acquireRelease(
        Effect.promise(
          async () => await mkdtemp(path.join(tmpdir(), "heb-stack-cli-"))
        ),
        (created) =>
          Effect.promise(async () => {
            await rm(created, { force: true, recursive: true });
          })
      );
      const history = path.join(directory, "history.json");

      const check = yield* Effect.promise(
        async () =>
          await runBuiltAdapter(
            CLI_ENTRY,
            "primes",
            "check",
            "--n",
            "97",
            "--history-file",
            history
          )
      );
      assert.equal(check.status, 0, check.stderr);
      assert.deepEqual(decodeAdapterAnswer(CheckOutputSchema, check.stdout), {
        n: 97,
        prime: true,
        smallestFactor: 97,
      });

      const listed = yield* Effect.promise(
        async () =>
          await runBuiltAdapter(
            CLI_ENTRY,
            "primes",
            "history",
            "list",
            `--history-file=${history}`
          )
      );
      assert.equal(listed.status, 0, listed.stderr);
      const { entries } = decodeAdapterAnswer(
        Schema.Struct({ entries: HistoryEntriesSchema }),
        listed.stdout
      );
      assert.deepEqual(
        entries.map((entry) => [entry.n, entry.prime]),
        [[97, true]]
      );

      const refused = yield* Effect.promise(
        async () =>
          await runBuiltAdapter(
            CLI_ENTRY,
            "call",
            "primes.check",
            '{"n":1}',
            "--history-file",
            history
          )
      );
      assert.equal(refused.status, 1, "A capability's own failure exits 1");
      assert.match(refused.stdout, /"OutOfRange"/u);
    })
);
