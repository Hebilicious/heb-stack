# @heb-stack/primes

The `primes` namespace: the one namespace this AcidCat catalog defines. Every capability id here begins with `primes.`, and the commands, tools and API methods every surface derives follow from those ids.

- `capabilities.ts` defines `primes.check`, `primes.next`, `primes.history.list` and `primes.history.clear`. The history is the record of numbers this session checked.
- `check-machine.ts` is the check lifecycle, `idle → checking → result | failed`. A new number interrupts the check in flight, and `RETRY` checks the failed number again. `checker.ts` hosts it as the `PrimeChecker` owner.
- `prime-math.ts` and `check-history.ts` are the services a host provides; `wasm-port.ts` implements `PrimeMath` over the Rust crate, and `history-store.ts` implements `CheckHistory` over any text store.

Only `packages/acidcat` imports this package. `moon run primes:test` proves the lifecycle.
