# primes

`smallest_factor(n: u64) -> u64` by trial division, compiled to `wasm32-unknown-unknown` with no bindings. A `u64`
crosses into TypeScript as a `bigint`, so the one port in `packages/application-primes/src/wasm-port.ts` passes and
checks `bigint`s. `moon run primes:test` covers 2, 97, 91 and 2^53 − 111.
