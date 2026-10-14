/** The conformance fixture as a command line, run by this repository's own CLI runner. */
import { Cli } from "@acid-cat/core-effect";
import { runCommandLine } from "@heb-stack/cli/run";
import { Command } from "effect/cli";

import { fixture, switchLayer } from "./fixture.capabilities.ts";

runCommandLine(
  Cli.command(fixture, { name: "fixture", version: "0.0.0" }).pipe(
    Command.provide(switchLayer)
  ),
  "0.0.0"
);
