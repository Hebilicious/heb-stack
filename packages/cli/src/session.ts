import { existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_WASM_PATH, defaultHistoryFile, type NodeSession } from "@heb-stack/node-runtime";
import { Option } from "effect";
import { Flag } from "effect/cli";
import { CLI_BUNDLE_DIRECTORY } from "./location.ts";

/** The flags every command shares: where the crate and the history live, and how to answer. */
export const sessionFlags = {
  wasm: Flag.String("wasm").pipe(
    Flag.withDescription(`The crate's release module (default: ${DEFAULT_WASM_PATH} in this checkout).`),
    Flag.optional,
  ),
  history: Flag.String("history").pipe(
    Flag.withDescription("The JSON file holding the check history (default: $XDG_STATE_HOME/heb-stack/history.json)."),
    Flag.optional,
  ),
  json: Flag.Boolean("json").pipe(Flag.withDescription("Print machine-readable output."), Flag.withDefault(false)),
};

export interface SessionFlags {
  readonly wasm: Option.Option<string>;
  readonly history: Option.Option<string>;
  readonly json: boolean;
}

/**
 * The checkout this binary was built from, or `null` when this module runs from source. A caller runs the binary from
 * any directory, so the crate's default path is resolved against the checkout the bundle sits in.
 */
function repositoryRoot(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  if (!here.endsWith(`${sep}${CLI_BUNDLE_DIRECTORY.split("/").join(sep)}`)) return null;
  const root = resolve(here, "..", "..");
  return existsSync(resolve(root, "crates", "primes")) ? root : null;
}

/** The session this command line describes, in the one shape every Node host takes. */
export function cliSession(flags: SessionFlags): NodeSession {
  const root = repositoryRoot();
  return {
    target: "cli",
    wasmPath: Option.getOrElse(flags.wasm, () =>
      root === null ? DEFAULT_WASM_PATH : resolve(root, DEFAULT_WASM_PATH),
    ),
    historyFile: Option.getOrElse(flags.history, defaultHistoryFile),
  };
}
