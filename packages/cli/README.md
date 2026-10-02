# @heb-stack/cli

The command line, built with Effect's CLI over the Node host.

```sh
moon run cli:install
.artifacts/bin/heb-stack list [--json]
.artifacts/bin/heb-stack call primes.check '{"n":97}' [--json]
```

`list` prints the leaves the `cli` target serves, and `call` invokes one by id. A capability's own failure exits 1, and an unknown capability exits 2. `--history <file>` and `--wasm <file>` override the defaults.
