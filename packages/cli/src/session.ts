import { existsSync } from "node:fs";
import path from "node:path";

import { acidCatLayer } from "@heb-stack/acidcat";
import {
  DEFAULT_WASM_PATH,
  defaultHistoryFile,
  nodeServices,
} from "@heb-stack/node-runtime";
import { Effect, Layer, Option } from "effect";
import { Flag, GlobalFlag } from "effect/cli";

import { CLI_BUNDLE_DIRECTORY } from "./location.ts";

/** `--history-file`: where the session keeps its checks. */
export const HistoryFile = GlobalFlag.Setting("history-file")({
  flag: Flag.String("history-file").pipe(
    Flag.withDescription(
      "The JSON file holding the check history (default: $XDG_STATE_HOME/heb-stack/history.json)."
    ),
    Flag.optional
  ),
});

/** `--wasm`: where the session finds the crate. */
export const Wasm = GlobalFlag.Setting("wasm")({
  flag: Flag.String("wasm").pipe(
    Flag.withDescription(
      `The crate's release module (default: ${DEFAULT_WASM_PATH} in this checkout).`
    ),
    Flag.optional
  ),
});

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

/**
 * The services of the session one command runs in, from the session's flags. Their names cannot be a capability
 * input's: `effect/cli` refuses a flag declared twice when the program starts.
 */
export const cliServices = Layer.unwrap(
  Effect.gen(function* () {
    const historyFile = yield* HistoryFile;
    const wasm = yield* Wasm;
    const root = repositoryRoot();
    return acidCatLayer(
      nodeServices({
        historyFile: Option.getOrElse(historyFile, defaultHistoryFile),
        wasmPath: Option.getOrElse(wasm, () =>
          root === null
            ? DEFAULT_WASM_PATH
            : path.resolve(root, DEFAULT_WASM_PATH)
        ),
      })
    );
  })
);
