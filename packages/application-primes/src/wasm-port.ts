import { Effect, Layer } from "effect";

import { PrimeMath } from "./prime-math.ts";

/** The crate's one export, as TypeScript sees it: a `u64` crosses the boundary as a `bigint`. */
export interface PrimesWasm {
  readonly smallestFactor: (n: bigint) => bigint;
}

/** BOUNDARY: A module's exports are untyped until this port checks the one function the crate promises. */
export function primesWasm(module: WebAssembly.Module): PrimesWasm {
  const exported: unknown = new WebAssembly.Instance(module).exports
    .smallest_factor;
  if (typeof exported !== "function") {
    throw new TypeError(
      "The primes module exports no smallest_factor function"
    );
  }
  return {
    smallestFactor: (n) => {
      // oxlint-disable-next-line typescript/no-unsafe-call -- BOUNDARY: the crate's export is called with the u64 it declares, and its answer is checked below.
      const factor: unknown = exported(n);
      if (typeof factor !== "bigint") {
        throw new TypeError(
          "smallest_factor answered something other than a u64"
        );
      }
      return factor;
    },
  };
}

/** `PrimeMath` over the compiled crate, instantiated once for the session that holds this Layer. */
export function primeMathWasmLayer(
  module: WebAssembly.Module
): Layer.Layer<PrimeMath> {
  return Layer.sync(PrimeMath, () => {
    const crate = primesWasm(module);
    return PrimeMath.of({
      smallestFactor: (n) => Effect.sync(() => crate.smallestFactor(n)),
    });
  });
}
