# Features

The behaviour, in Gherkin, and the adapter proofs. Each step returns its Effect to the runner in `support/`, which runs it in the scenario's Scope.

- `primes/primes.feature`: the capabilities over the crate.
- `primes/targets.feature`: each adapter lists exactly its target's leaves, MCP refuses `history.clear` by name, and capnweb refuses a batch that is not UTF-8.
- `web/check.vue.feature`: the Vapor page, mounted in happy-dom.
- `adapters/`: the built CLI in a process, MCP `tools/list` and `tools/call`, and `acid-cat conform` against the MCP, CLI and WebMCP hosting, serving the specification's fixture (`conformance/`).

`moon run features:test` runs them all.
