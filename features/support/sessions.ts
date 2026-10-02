import { readFile } from "node:fs/promises";
import type { AcidCat } from "@heb-stack/acidcat";
import { DEFAULT_WASM_PATH } from "@heb-stack/node-runtime";
import { Effect, Schema, type Scope } from "effect";

/** The crate as a Node process compiles it, from the release build `moon run primes:build` writes. */
export const compiledCrate: Effect.Effect<WebAssembly.Module> = Effect.promise(async () =>
  WebAssembly.compile(await readFile(DEFAULT_WASM_PATH)),
);

/** A session that belongs to the scope opening it, so a failing step still disposes it. */
export function scopedSession(open: () => Promise<AcidCat>): Effect.Effect<AcidCat, never, Scope.Scope> {
  return Effect.acquireRelease(Effect.promise(open), (root) => Effect.promise(() => root.dispose()));
}

/** An in-memory `Storage`, so a browser-runtime Layer runs without a browser. */
export function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/* BOUNDARY: Decode an adapter's wire answer with the schema that owns its shape. */
export function decode<Value>(schema: Schema.Codec<Value, unknown>, value: unknown): Value {
  return Schema.decodeUnknownSync(schema)(value);
}

export function required<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) throw new Error(`Expected the ${name} to exist`);
  return value;
}
