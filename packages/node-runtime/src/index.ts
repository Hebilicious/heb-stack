import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createAcidCat, type AcidCat, type SessionTarget } from "@heb-stack/acidcat";
import {
  StorageUnavailableSchema,
  checkHistoryLayer,
  primeMathWasmLayer,
  type HistoryText,
} from "@heb-stack/acidcat/primes";
import { Effect, Layer, Predicate } from "effect";

/** The crate's release module, relative to the repository root. */
export const DEFAULT_WASM_PATH = "crates/primes/target/wasm32-unknown-unknown/release/primes.wasm";

/** Where a Node session keeps its checks unless a caller names a file: the user's XDG state directory. */
export function defaultHistoryFile(): string {
  const state = process.env["XDG_STATE_HOME"];
  return join(
    state === undefined || state === "" ? join(homedir(), ".local", "state") : state,
    "heb-stack",
    "history.json",
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
export async function createNodeAcidCat(session: NodeSession): Promise<AcidCat> {
  const module = await WebAssembly.compile(await readFile(session.wasmPath));
  const math = primeMathWasmLayer(module);
  return createAcidCat(
    { target: session.target },
    session.historyFile === null ? math : Layer.merge(math, checkHistoryLayer(fileText(session.historyFile))),
  );
}

/** The history document as one file, created with its directory on the first write. */
function fileText(path: string): HistoryText {
  const unavailable = (cause: unknown) =>
    StorageUnavailableSchema.make({ reason: `${path}: ${cause instanceof Error ? cause.message : "unavailable"}` });
  return {
    read: Effect.tryPromise({
      try: () => readFile(path, "utf8"),
      catch: (cause) => ({ cause }),
    }).pipe(
      Effect.catch(({ cause }) =>
        Predicate.hasProperty(cause, "code") && cause.code === "ENOENT"
          ? Effect.succeed(null)
          : Effect.fail(unavailable(cause)),
      ),
    ),
    write: (text) =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, `${text}\n`, "utf8");
        },
        catch: unavailable,
      }),
    remove: Effect.tryPromise({ try: () => rm(path, { force: true }), catch: unavailable }),
  };
}
