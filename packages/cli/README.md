# @heb-stack/cli

`cli`: the AcidCat catalog from a terminal, for agents and people alike. It is the CLI binding of `@acid-cat/core-effect` for the `cli` target, over the Node host.

```sh
moon run cli:install
.artifacts/bin/cli primes check --n 97
.artifacts/bin/cli primes next --after=97
.artifacts/bin/cli primes history list
.artifacts/bin/cli call primes.check '{"n":97}'
.artifacts/bin/cli list
```

The commands come from the catalog: a capability's id becomes its path, so `primes.history.list` is `cli primes history list`, and each property of its input schema becomes a flag, written `--n 97` or `--n=97`. A new capability whose audience names `cli` gets its command without a change here.

A value or a capability's own failure is JSON on standard output, with exit code 0 or 1. A call that gives no result writes `{ kind, message }` on standard error, with exit code 2 (`unknown-capability`), 3 (`invalid-input`), 4 (`unavailable`), 5 (`internal`) or 130 (`cancelled`, after an interrupt).

`--history-file <file>` and `--wasm <file>` are global flags: they say where the session keeps its history and finds the crate. `src/run.ts` runs any such command line as the process's main program; the conformance evidence runs the specification's fixture through it.
