/**
 * The heb-stack command line: `list` prints what the `cli` target serves and `call` invokes one capability by its id.
 * Effect's CLI owns argv and the generated help; the adapter holds no capability map, so a leaf whose audience names
 * `cli` is reachable here without a change to this file.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { servedCapabilities } from "@heb-stack/acidcat";
import type { AcidCat, Result } from "@heb-stack/acidcat";
import { createNodeAcidCat } from "@heb-stack/node-runtime";
import { Cause, Effect, Option, Schema } from "effect";
import { Argument, CliError, Command } from "effect/cli";

import packageJson from "../package.json" with { type: "json" };
import { commandCatalogEntries } from "./catalog.ts";
import { cliSession, sessionFlags } from "./session.ts";
import type { SessionFlags } from "./session.ts";

/** Open the session the flags describe, run one command against it, and release it. */
const withSession = Effect.fn("withSession")(function* (
  flags: SessionFlags,
  body: (root: AcidCat) => Effect.Effect<void, CliError.UserError>
) {
  const root = yield* Effect.promise(
    async () => await createNodeAcidCat(cliSession(flags))
  );
  yield* body(root).pipe(
    Effect.ensuring(
      Effect.promise(async () => {
        await root.dispose();
      })
    )
  );
});

const listCommand = Command.make("list", { ...sessionFlags }, (flags) =>
  withSession(flags, (root) =>
    Effect.sync(() => {
      const entries = commandCatalogEntries(root.catalog, root.target);
      process.stdout.write(
        flags.json
          ? `${JSON.stringify(entries, null, 2)}\n`
          : `${entries.map((entry) => `${entry.id.padEnd(16)} ${entry.description}`).join("\n")}\n`
      );
    })
  )
).pipe(
  Command.withDescription("List the capabilities this command line serves.")
);

const callCommand = Command.make(
  "call",
  {
    capabilityId: Argument.String("capability").pipe(
      Argument.withDescription("The capability's id, e.g. primes.check")
    ),
    input: Argument.String("input").pipe(
      Argument.withDescription(
        "The capability input as JSON, e.g. '{\"n\":97}'"
      ),
      Argument.withDefault("{}")
    ),
    ...sessionFlags,
  },
  (flags) =>
    withSession(flags, (root) =>
      Effect.gen(function* () {
        const leaf = servedCapabilities(root.catalog, root.target).find(
          (entry) => entry.id === flags.capabilityId
        );
        if (leaf === undefined) {
          yield* Effect.sync(() => {
            process.stderr.write(`Unknown capability: ${flags.capabilityId}\n`);
            process.exitCode = 2;
          });
          return;
        }
        const input = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(Schema.Json)
        )(flags.input).pipe(
          Effect.mapError(
            (issue) =>
              new CliError.UserError({
                cause: issue,
                userMessage: "The capability input is not valid JSON",
              })
          )
        );
        const result = yield* Effect.promise(
          async () => await leaf.invokeExternal(input)
        );
        yield* Effect.sync(() => {
          process.exitCode = printResult(result, flags.json);
        });
      })
    )
).pipe(
  Command.withDescription("Invoke one capability by its id."),
  Command.withExamples([
    {
      command: `heb-stack call primes.check '{"n":97}' --json`,
      description: "Check whether 97 is prime",
    },
    {
      command: `heb-stack call primes.next '{"after":97}'`,
      description: "Find the next prime after 97",
    },
  ])
);

const application = Command.make("heb-stack").pipe(
  Command.withDescription("The heb-stack prime checker from a terminal."),
  Command.withSubcommands([listCommand, callCommand])
);

application.pipe(
  Command.run({ version: packageJson.version }),
  Effect.provide(NodeServices.layer),
  // The answer is on standard output, so a defect is reported on standard error, with the failure code set here.
  Effect.catchDefect((defect) =>
    Effect.sync(() => {
      process.stderr.write(`${Cause.pretty(Cause.die(defect))}\n`);
      process.exitCode = 1;
    })
  ),
  NodeRuntime.runMain({ disableErrorReporting: true })
);

/** A capability's answer on standard output; its own failure exits 1 and prints as JSON or one line. */
function printResult(result: Result<unknown, unknown>, json: boolean): number {
  if (result.ok) {
    process.stdout.write(
      `${JSON.stringify(result.value, null, json ? 2 : undefined)}\n`
    );
    return 0;
  }
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ error: result.error, ok: false }, null, 2)}\n`
    );
  } else {
    process.stderr.write(`${failureLine(result.error)}\n`);
  }
  return 1;
}

const TaggedFailureSchema = Schema.Struct({ _tag: Schema.String });

/** BOUNDARY: A capability failure is wire data; its tag names it, and the whole value follows. */
function failureLine(failure: unknown): string {
  const tagged = Schema.decodeUnknownOption(TaggedFailureSchema)(failure);
  return Option.isSome(tagged)
    ? `${tagged.value._tag}: ${JSON.stringify(failure)}`
    : JSON.stringify(failure);
}
