/** The conformance fixture as a command line, run the way `cli` runs: `Cli.command`, then `NodeCli.runCommand`. */
import { Cli } from "@acid-cat/core-effect";
import { NodeCli } from "@acid-cat/core-effect/node";
import { Command } from "effect/cli";

import { fixture, fixtureLayer } from "./fixture.capabilities.ts";
import { fileMarker } from "./marker.ts";

// Each call is its own process, so holds and subscriptions tell the checks they began and ended through marker files.
NodeCli.runCommand(
  Cli.command(fixture, { name: "fixture", version: "0.0.0" }).pipe(
    Command.provide(fixtureLayer(fileMarker))
  ),
  { version: "0.0.0" }
);
