/** The marker files of the conformance fixture, which tell the checks when a call or a subscription starts and ends. */
import { rm, writeFile } from "node:fs/promises";

import { Effect } from "effect";

/**
 * Writes a marker file when a call starts to hold or a subscription starts, and removes it when that ends. Only the
 * command line gives one: each of its calls is its own process, so the checks learn what it does from the files.
 */
export interface Marker {
  readonly remove: (path: string) => Effect.Effect<void>;
  readonly write: (path: string) => Effect.Effect<void>;
}

/** The marker the command line uses: an empty file at the path, removed when the call or subscription ends. */
export const fileMarker: Marker = {
  remove: (path) =>
    Effect.promise(async () => {
      await rm(path, { force: true });
    }),
  write: (path) =>
    Effect.promise(async () => {
      await writeFile(path, "");
    }),
};
