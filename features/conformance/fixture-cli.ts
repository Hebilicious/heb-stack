/** The conformance fixture as a command line, run the way `cli` runs: `Cli.command`, then `NodeCli.runCommand`. */
import { writeFile } from "node:fs/promises";

import { Cli } from "@acid-cat/core-effect";
import { NodeCli } from "@acid-cat/core-effect/node";
import { Effect } from "effect";
import { Command } from "effect/cli";

import { fixture, fixtureLayer } from "./fixture.capabilities.ts";

/** Each call is its own process, so a hold tells the checks it began by writing its marker file. */
const writeMarker = (file: string) =>
  Effect.promise(async () => {
    await writeFile(file, "");
  });

NodeCli.runCommand(
  Cli.command(fixture, { name: "fixture", version: "0.0.0" }).pipe(
    Command.provide(fixtureLayer(writeMarker))
  ),
  { version: "0.0.0" }
);
