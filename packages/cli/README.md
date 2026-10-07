# @heb-stack/cli

`cli`: the AcidCat catalog from a terminal, built with Effect's CLI over the Node host. Every answer is JSON on standard output, so an agent can parse it, and every leaf is also a command a person can type.

```sh
moon run cli:install
.artifacts/bin/cli primes check --n 97
.artifacts/bin/cli primes next --after=97
.artifacts/bin/cli primes history list
.artifacts/bin/cli call primes.check '{"n":97}'
.artifacts/bin/cli list
```

The commands are derived from the catalog (`src/capability-commands.ts`): a leaf's id becomes its path, so `primes.history.list` is `cli primes history list`, and each property of its input JSON Schema becomes a flag, written `--n 97` or `--n=97`, typed as the schema says, with the schema's description as its help. A new leaf whose audience names `cli` gets its command without a change here.

`call` invokes any leaf by id with JSON input, and `list` prints every leaf with its usage line. A capability's own failure prints its tagged value and exits 1; an id this target does not serve exits 2. `--history-file <file>` and `--wasm <file>` override where the session keeps its history and finds the crate.
