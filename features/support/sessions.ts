import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_WASM_PATH } from "@heb-stack/node-runtime";
import { Effect, Schema } from "effect";
import type { Scope } from "effect";

/** The checkout these proofs run in, whatever directory the runner started from. */
export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");

/** The crate's release module, which `moon run primes-wasm:build` writes. */
export const CRATE_PATH = path.resolve(REPOSITORY_ROOT, DEFAULT_WASM_PATH);

/** The crate as a Node process compiles it, from the release build `moon run primes-wasm:build` writes. */
export const compiledCrate: Effect.Effect<WebAssembly.Module> = Effect.promise(
  async () => await WebAssembly.compile(await readFile(CRATE_PATH))
);

/** A session that belongs to the scope opening it, so a failing step still disposes it. */
export function scopedSession<
  Session extends { readonly dispose: () => Promise<void> },
>(open: () => Promise<Session>): Effect.Effect<Session, never, Scope.Scope> {
  return Effect.acquireRelease(Effect.promise(open), (root) =>
    Effect.promise(async () => {
      await root.dispose();
    })
  );
}

/** An in-memory `Storage`, so a browser-runtime Layer runs without a browser. */
export function memoryStorage(): Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

/* BOUNDARY: Decode an adapter's wire answer with the schema that owns its shape. */
export function decode<Value>(
  schema: Schema.Codec<Value, unknown>,
  value: unknown
): Value {
  return Schema.decodeUnknownSync(schema)(value);
}

export function required<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) {
    throw new Error(`Expected the ${name} to exist`);
  }
  return value;
}
