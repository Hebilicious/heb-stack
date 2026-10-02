# @heb-stack/application-primes

The prime domain: four capabilities, one lifecycle machine and two services.

- `capabilities.ts` defines `primes.check`, `primes.next`, `history.list` and `history.clear`.
- `check-machine.ts` is the check lifecycle, `idle → checking → result | failed`. A new number interrupts the check in flight, and `RETRY` checks the failed number again. `checker.ts` hosts it as the `PrimeChecker` owner.
- `prime-math.ts` and `check-history.ts` are the services a host provides; `wasm-port.ts` implements `PrimeMath` over the Rust crate, and `history-store.ts` implements `CheckHistory` over any text store.

Only `packages/acidcat` imports this package. `moon run application-primes:test` proves the lifecycle.
