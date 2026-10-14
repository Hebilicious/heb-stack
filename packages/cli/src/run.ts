import { CLI_EXIT_CODES } from "@acid-cat/spec-ts";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Predicate } from "effect";
import { Command } from "effect/cli";
import type { CliError } from "effect/cli";

/**
 * The exit code of a usage error, as the CLI binding numbers them: an unknown command is an unknown capability, and
 * any other usage error is invalid input. `effect/cli` reports each usage error as help, which lists the errors; help
 * with no error is a request for help, and succeeds. This mirrors `Cli.run` of `@acid-cat/core-effect`, which keeps it
 * private.
 */
function usageExitCode(error: CliError.CliError): number {
  const errors: readonly CliError.CliError[] = Predicate.isTagged(
    error,
    "ShowHelp"
  )
    ? error.errors
    : [error];
  if (errors.length === 0) {
    return CLI_EXIT_CODES.value;
  }
  return errors.some((inner) => Predicate.isTagged(inner, "UnknownSubcommand"))
    ? CLI_EXIT_CODES["unknown-capability"]
    : CLI_EXIT_CODES["invalid-input"];
}

/**
 * Run a command line made from a catalog as this process's main program. A capability's outcome sets the exit code as
 * the binding sets it, and a usage error is numbered as the binding numbers it. An interrupt cancels the call in flight.
 */
export function runCommandLine<Name extends string, Input, ContextInput>(
  command: Command.Command<Name, Input, ContextInput>,
  version: string
): void {
  const program = Command.run(command, { version }).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.sync(() => {
          process.exitCode = usageExitCode(error);
        }),
      onSuccess: () => Effect.void,
    }),
    Effect.provide(NodeServices.layer)
  );
  NodeRuntime.runMain(program);
}
