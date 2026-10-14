/** The conformance fixture as a command line, run the way `cli` runs: `Cli.command`, then `NodeCli.runCommand`. */
import { Cli } from "@acid-cat/core-effect";
import { NodeCli } from "@acid-cat/core-effect/node";
import { Command } from "effect/cli";

import { fixture, switchLayer } from "./fixture.capabilities.ts";

NodeCli.runCommand(
  Cli.command(fixture, { name: "fixture", version: "0.0.0" }).pipe(
    Command.provide(switchLayer)
  ),
  { version: "0.0.0" }
);
