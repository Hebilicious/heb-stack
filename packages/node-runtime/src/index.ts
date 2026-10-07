import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { createAcidCat } from "@heb-stack/acidcat";
import type { AcidCat, SessionTarget } from "@heb-stack/acidcat";
import {
  StorageUnavailableSchema,
  checkHistoryLayer,
  primeMathWasmLayer,
} from "@heb-stack/acidcat/primes";
import type { HistoryText } from "@heb-stack/acidcat/primes";
import { Effect, Layer, Predicate } from "effect";

/** The crate's release module, relative to the repository root. */
export const DEFAULT_WASM_PATH =
  "crates/primes/target/wasm32-unknown-unknown/release/primes.wasm";

/** Where a Node session keeps its checks unless a caller names a file: the user's XDG state directory. */
export function defaultHistoryFile(): string {
  const state = process.env.XDG_STATE_HOME;
  return path.join(
    state === undefined || state === ""
      ? path.join(homedir(), ".local", "state")
      : state,
    "acidcat",
    "history.json"
  );
}

/**
 * One Node session, host-independent: a command line parses its argv into this, and any other Node adapter parses its
 * own options into the same shape.
 */
export interface NodeSession {
  readonly target: SessionTarget;
  /** The crate's release module, compiled once when the session opens. */
  readonly wasmPath: string;
  /** The JSON file holding the check history, or `null` for a session that keeps none. */
  readonly historyFile: string | null;
}

/** Open the canonical AcidCat session without a browser: the crate in this process, the history in a file. */
export async function createNodeAcidCat(
  session: NodeSession
): Promise<AcidCat> {
  const module = await WebAssembly.compile(await readFile(session.wasmPath));
  const math = primeMathWasmLayer(module);
  return await createAcidCat(
    { target: session.target },
    session.historyFile === null
      ? math
      : Layer.merge(math, checkHistoryLayer(fileText(session.historyFile)))
  );
}

/** The history document as one file, created with its directory on the first write. */
function fileText(file: string): HistoryText {
  const unavailable = (cause: unknown) =>
    StorageUnavailableSchema.make({
      reason: `${file}: ${cause instanceof Error ? cause.message : "unavailable"}`,
    });
  return {
    read: Effect.tryPromise({
      catch: unavailable,
      // An absent file is a history nobody has written yet, not a failure.
      try: async () => {
        try {
          return await readFile(file, "utf-8");
        } catch (error) {
          if (Predicate.hasProperty(error, "code") && error.code === "ENOENT") {
            return null;
          }
          throw error;
        }
      },
    }),
    remove: Effect.tryPromise({
      catch: unavailable,
      try: async () => {
        await rm(file, { force: true });
      },
    }),
    write: (text) =>
      Effect.tryPromise({
        catch: unavailable,
        try: async () => {
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, `${text}\n`, "utf-8");
        },
      }),
  };
}
