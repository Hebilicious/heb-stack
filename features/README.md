# Features

The behaviour, in Gherkin, and the adapter proofs. Each step returns its Effect to the runner in `support/`, which runs it in the scenario's Scope.

- `primes/primes.feature`: the capabilities over the crate.
- `primes/targets.feature`: a capability reaches only the targets its audience names.
- `adapters/`: the built CLI records a check in its history file, and the Worker's MCP endpoint answers `tools/call`.

`moon run features:test` runs them all.
