/**
 * `cli`: the AcidCat catalog from a terminal, for agents and people alike.
 *
 * The CLI binding of `@acid-cat/core-effect` serves the `cli` target: every leaf is a command derived from the
 * catalog (`cli primes check --n 97`), `call` invokes a leaf by id with JSON input, and `list` prints the view with
 * each leaf's availability and usage. A result is JSON on standard output; a call failure is `{ kind, message }` on
 * standard error, and the exit code tells the outcome apart.
 */
import { Cli } from "@acid-cat/core-effect";
import { NodeCli } from "@acid-cat/core-effect/node";
import { app } from "@heb-stack/acidcat";
import { Command } from "effect/cli";

import packageJson from "../package.json" with { type: "json" };
import { cliServices, HistoryFile, Wasm } from "./session.ts";

/** The binary's name, which every usage line starts with. */
const BINARY = "cli";

const command = Cli.command(app, {
  name: BINARY,
  target: "cli",
  version: packageJson.version,
}).pipe(
  Command.provide(cliServices),
  Command.withGlobalFlags([HistoryFile, Wasm]),
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
    {
      command: `${BINARY} call primes.check '{"n":97}'`,
      description: "Check whether 97 is prime, with JSON input",
    },
  ])
);

NodeCli.runCommand(command, { version: packageJson.version });
