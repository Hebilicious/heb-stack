# primes

`smallest_factor(n: u64) -> u64` by trial division, compiled to `wasm32-unknown-unknown` with no bindings. A `u64`
crosses into TypeScript as a `bigint`, so the one port in `packages/primes/src/wasm-port.ts` passes and
checks `bigint`s.
