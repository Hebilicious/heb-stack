# heb-stack

A starter that shows how the stack fits together: one capability catalog, served to five surfaces, over Effect
services and an XState lifecycle. The demo is a prime checker, kept as small as the wiring allows.

## Quick start

The toolchain is pinned in `.prototools` (proto, moon, Node, pnpm, Rust) and `rust-toolchain.toml`.

```sh
proto install                # install the pinned toolchain
pnpm install
moon run app:verify          # format, lint, types, Effect diagnostics, tests, features, the browser, the crate
moon run app:hooks-install   # format on commit; lint and typecheck on push
```

Run it:

```sh
moon run app:dev             # the page, /rpc and /mcp on http://127.0.0.1:8787, rebuilt on every change
moon run app:cli-install     # writes .artifacts/bin/heb-stack
.artifacts/bin/heb-stack call primes.check '{"n":97}' --json
.artifacts/bin/heb-stack list
moon run app:branch-deploy   # a Cloudflare preview version for this branch; the live deployment is untouched
```

`branch-deploy` needs `cf auth login` (or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`) and a branch other than
`main`. No account, zone or worker route lives in the repository.

## The demo

| Capability      | Kind    | Input                     | Answers                                 | Fails with                      | Targets            |
| --------------- | ------- | ------------------------- | --------------------------------------- | ------------------------------- | ------------------ |
| `primes.check`  | query   | `{ n }`, 2 ≤ n ≤ 2^53 − 1 | `{ n, prime, smallestFactor }`          | `OutOfRange { n, min, max }`    | web, cli, mcp, rpc |
| `primes.next`   | query   | `{ after }`               | `{ after, prime }`                      | `OutOfRange`                    | web, cli, mcp, rpc |
| `history.list`  | query   | `{}`                      | `{ entries }`, at most 20, newest first | —                               | web, cli           |
| `history.clear` | command | `{}`                      | `{ cleared }`                           | `StorageUnavailable { reason }` | web, cli           |

`primes.check` records the check when the session keeps a history: the page in browser storage, the command line in a
JSON file (`--history`, by default `$XDG_STATE_HOME/heb-stack/history.json`). A Worker session keeps none, so MCP and
capnweb neither list the history leaves nor reach them by name. `primes.next` searches above `after` by asking the same
`PrimeMath` service a check asks; past 2^53 − 112 the next prime is no longer an exact JSON number, so `OutOfRange`
names that bound.

The check lifecycle is `packages/application-primes/src/check-machine.ts`: `idle → checking → result | failed`. A new
number re-enters `checking`, which interrupts the Effect in flight; checking the number that just failed sends `RETRY`.
The owner hosts the actor in its Layer and publishes a detached snapshot; the page reads it through an atom.

## Layers

```text
                           crates/primes ── smallest_factor(u64) -> u64, wasm32
                                 │ one typed port (wasm-port.ts)
  packages/application-primes ───┤ capabilities.ts · check-machine.ts · PrimeMath · CheckHistory
                                 │
           packages/acidcat ── one catalog: primes.{check,next} · history.{list,clear}
                                 │  each session is created for one target; a leaf reaches it
                                 │  only when its own audience names that target
   ┌─────────────┬──────────────┼───────────────┬───────────────┐
  Vue          WebMCP          CLI             MCP          capnweb
 (web)         (web)          (cli)           (mcp)          (rpc)
 apps/web   webmcp-adapter  packages/cli   packages/mcp   packages/rpc
   │             │              │               │               │
   └── browser-runtime ──┘   node-runtime     └── edge-runtime (workers/api) ──┘
   PrimeMathRemote over capnweb  PrimeMathWasm     PrimeMathWasm, no history
   CheckHistoryLocal             CheckHistoryFile
```

Each host supplies Layers and nothing else: `browser-runtime` gives the page `PrimeMath` over capnweb and the history
in browser storage; `node-runtime` gives the CLI the crate in-process and a history file; `edge-runtime` gives the
Worker the crate, compiled once per isolate, and no history. Adapters walk the catalog; none holds a capability map.

## AcidCat

The root (`packages/acidcat`) is the only package that imports a domain package; adapters import the root, and the
`anti-slop-effect/no-application-bypass` lint rule enforces it. A capability definition carries its id, description,
audience, and a program: Effect Schema input, output and error, and one computation returning an Effect. External
adapters call `invokeExternal`, which decodes the caller's input with the leaf's schema and encodes a `Result`, so a
typed failure such as `OutOfRange` travels as data and a defect fails the call instead. The WebMCP manifest
(`moon run app:manifest-generate`) is derived from the same definitions at build time, so JSON Schema conversion never
ships to the browser.

## Evidence

| Seam                        | Proof                                                                                                                               | Task           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Capabilities over the crate | `features/primes/primes.feature` (Gherkin; steps return Effects)                                                                    | `feature-test` |
| Targets                     | `features/primes/targets.feature`: WebMCP, CLI, MCP and capnweb each list exactly their leaves; MCP refuses `history.clear` by name | `feature-test` |
| The page                    | `features/web/check.vue.feature`: the Vapor component, typing 91 shows "91 = 7 × 13"                                                | `feature-test` |
| The lifecycle               | `packages/application-primes/src/checker.test.ts`: replacement interrupts the check in flight; a failed check retries               | `test`         |
| CLI                         | `features/adapters/cli-process.test.ts`: the built binary, in a process                                                             | `test`         |
| MCP                         | `features/adapters/mcp-http.test.ts`: `tools/list` and `tools/call`                                                                 | `test`         |
| Browser                     | `e2e/check.spec.ts`: a check over capnweb against `cf dev`, and the history after a reload                                          | `browser-test` |
| Rust                        | `crates/primes/tests`: 2, 97, 91 and 2^53 − 111                                                                                     | `cargo-test`   |

Deadlines are hang guards, never paces, and nothing retries.

## How this differs from rat-stack

[rat-stack](https://github.com/joelhooks/rat-stack) is the model for the shape: one contract projected onto every
surface, XState owning lifecycles through `@xstate/effect`, and a fence of lint and type rules. The choices differ:

| Piece              | rat-stack                                             | heb-stack                                                                                                       |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tasks              | pnpm scripts + Turborepo                              | Moon tasks only; no `package.json` scripts                                                                      |
| Toolchain          | `.nvmrc`, `engines`                                   | proto pins proto, moon, Node, pnpm and Rust in `.prototools`                                                    |
| Capability model   | `defineContract` / `implement`, projected per surface | AcidCat leaves with per-target audiences, one catalog walked by generic adapters                                |
| Surfaces           | CLI, HTTP API + OpenAPI, MCP over stdio, code mode    | Vue page, in-page WebMCP, CLI, MCP over HTTP on the Worker, capnweb RPC                                         |
| UI                 | TanStack Router/Start                                 | Vue 3.6 in Vapor mode, built by Vite and vize, styled with cssforge tokens, read through `@effect/atom-vue`     |
| RPC                | Effect RPC projection                                 | capnweb over HTTP batches                                                                                       |
| Infrastructure     | Alchemy stack                                         | `cf` and wrangler with `cloudflare.config.ts`; previews are aliased versions                                    |
| Native code        | —                                                     | a Rust crate compiled to WASM behind one typed port                                                             |
| Tests              | `@effect/vitest` `it.effect`                          | Gherkin features run by the manifest runner on Vitest; `testEffect` for plain tests; Playwright for the browser |
| Lint and format    | Oxlint + Ultracite + Oxfmt                            | Oxlint with the vendored anti-slop rules and this repo's Effect rules, Oxfmt, and vize for Vue                  |
| Effect diagnostics | `@effect/tsgo` patches `tsc` in `prepare`             | `effect-tsgo diagnostics` as its own Moon task                                                                  |
| Environment        | varlock `.env.schema`                                 | no environment variables; the Worker's bindings are typed from `cloudflare.config.ts`                           |
| Agent tooling      | vendored source mirrors, skills, editor hooks         | none: `AGENTS.md` holds the engineering rules                                                                   |

## Pins

Every dependency is pinned exactly in the `catalog` of `pnpm-workspace.yaml`; packages name `catalog:`.
