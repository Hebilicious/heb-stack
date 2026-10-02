import { existsSync } from "node:fs";
import path from "node:path";

import { DEFAULT_WASM_PATH, defaultHistoryFile } from "@heb-stack/node-runtime";
import type { NodeSession } from "@heb-stack/node-runtime";
import { Option } from "effect";
import { Flag } from "effect/cli";

import { CLI_BUNDLE_DIRECTORY } from "./location.ts";

/** The flags every command shares: where the crate and the history live, and how to answer. */
export const sessionFlags = {
  history: Flag.String("history").pipe(
    Flag.withDescription(
      "The JSON file holding the check history (default: $XDG_STATE_HOME/heb-stack/history.json)."
    ),
    Flag.optional
  ),
  json: Flag.Boolean("json").pipe(
    Flag.withDescription("Print machine-readable output."),
    Flag.withDefault(false)
  ),
  wasm: Flag.String("wasm").pipe(
    Flag.withDescription(
      `The crate's release module (default: ${DEFAULT_WASM_PATH} in this checkout).`
    ),
    Flag.optional
  ),
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
  const here = import.meta.dirname;
  if (
    !here.endsWith(
      `${path.sep}${CLI_BUNDLE_DIRECTORY.split("/").join(path.sep)}`
    )
  ) {
    return null;
  }
  const root = path.resolve(here, "..", "..");
  return existsSync(path.resolve(root, "crates", "primes")) ? root : null;
}

/** The session this command line describes, in the one shape every Node host takes. */
export function cliSession(flags: SessionFlags): NodeSession {
  const root = repositoryRoot();
  return {
    historyFile: Option.getOrElse(flags.history, defaultHistoryFile),
    target: "cli",
    wasmPath: Option.getOrElse(flags.wasm, () =>
      root === null ? DEFAULT_WASM_PATH : path.resolve(root, DEFAULT_WASM_PATH)
    ),
  };
}
