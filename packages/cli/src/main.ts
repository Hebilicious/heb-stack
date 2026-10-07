/**
 * `cli`: the AcidCat catalog from a terminal, for agents and people alike.
 *
 * Every leaf the `cli` target serves is a command derived from the catalog: `cli primes check --n 97`. `call`
 * invokes any leaf by id with JSON input, and `list` prints what the target serves with each command's usage. Every
 * answer is JSON on standard output; a capability's own failure prints its tagged value and exits 1.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { servedCapabilities } from "@heb-stack/acidcat";
import type { AcidCat, Result } from "@heb-stack/acidcat";
import { createNodeAcidCat } from "@heb-stack/node-runtime";
import { Cause, Effect, Schema } from "effect";
import { Argument, CliError, Command } from "effect/cli";

import packageJson from "../package.json" with { type: "json" };
import { capabilityCommands } from "./capability-commands.ts";
import type { DerivedCommand } from "./capability-commands.ts";
import { commandCatalogEntries } from "./catalog.ts";
import { cliSession, sessionFlags } from "./session.ts";
import type { SessionFlags } from "./session.ts";

/** The binary's name, which every usage line starts with. */
const BINARY = "cli";

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

/** Print one JSON value, indented so a person can read it too. BOUNDARY: a capability's answer is wire data. */
function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/** A capability's answer: its value, or its own tagged failure with exit code 1. */
function printResult(result: Result<unknown, unknown>): void {
  printJson(result.ok ? result.value : result.error);
  process.exitCode = result.ok ? 0 : 1;
}

/** Invoke one leaf by id in the session the flags describe; an id this target does not serve exits 2. */
function invoke(
  flags: SessionFlags,
  id: string,
  input: typeof Schema.Json.Type
): Effect.Effect<void, CliError.UserError> {
  return withSession(flags, (root) =>
    Effect.gen(function* () {
      const leaf = servedCapabilities(root.catalog, root.target).find(
        (entry) => entry.id === id
      );
      if (leaf === undefined) {
        yield* Effect.sync(() => {
          process.stderr.write(`Unknown capability: ${id}\n`);
          process.exitCode = 2;
        });
        return;
      }
      const result = yield* Effect.promise(
        async () => await leaf.invokeExternal(input)
      );
      yield* Effect.sync(() => {
        printResult(result);
      });
    })
  );
}

const { commands, derived } = capabilityCommands(invoke);

/** The human form of a leaf's command, such as `cli primes check --n <integer>`. */
function usage(command: DerivedCommand): string {
  const flags = command.flags.map((flag) => `--${flag.name} <${flag.hint}>`);
  return [BINARY, ...command.path, ...flags].join(" ");
}

const listCommand = Command.make("list", { ...sessionFlags }, (flags) =>
  withSession(flags, (root) =>
    Effect.sync(() => {
      const usages = new Map(
        derived.map((command) => [command.id, usage(command)])
      );
      printJson(
        commandCatalogEntries(root.catalog, root.target).map((entry) => ({
          ...entry,
          usage: usages.get(entry.id) ?? `${BINARY} call ${entry.id} '<json>'`,
        }))
      );
    })
  )
).pipe(
  Command.withDescription(
    "List the capabilities this command line serves, with how to call each."
  )
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
    Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Json))(
      flags.input
    ).pipe(
      Effect.mapError(
        (issue) =>
          new CliError.UserError({
            cause: issue,
            userMessage: "The capability input is not valid JSON",
          })
      ),
      Effect.flatMap((input) => invoke(flags, flags.capabilityId, input))
    )
).pipe(
  Command.withDescription("Invoke one capability by its id with JSON input."),
  Command.withExamples([
    {
      command: `${BINARY} call primes.check '{"n":97}'`,
      description: "Check whether 97 is prime",
    },
  ])
);

const application = Command.make(BINARY).pipe(
  Command.withDescription(
    "The AcidCat catalog from a terminal. Every answer is JSON."
  ),
  Command.withExamples([
    {
      command: `${BINARY} primes check --n 97`,
      description: "Check whether 97 is prime",
    },
    {
      command: `${BINARY} primes next --after=97`,
      description: "Find the next prime after 97",
    },
    {
      command: `${BINARY} primes history list`,
      description: "List the last checks",
    },
  ]),
  Command.withSubcommands([listCommand, callCommand, ...commands])
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
