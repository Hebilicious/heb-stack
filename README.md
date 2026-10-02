# heb-stack

_One capability catalog, five surfaces, and a fence that makes the shortcut the wrong path._

A starter for an Effect application on Cloudflare. It ships as a **pnpm + Moon workspace** with a Vue Vapor page, an Effect CLI, an MCP endpoint, a capnweb API, in-page WebMCP tools, a Rust crate compiled to WebAssembly, Gherkin features, and a browser test. The demo is a prime checker, kept as small as the wiring allows.

The shape it teaches: define a **capability** once (Effect Schema input, output and failure, plus one Effect computation), let its owner run the lifecycle in an XState machine, and serve it to every surface from one catalog. `primes.check` is a typed call from the page, a WebMCP tool for an agent in the page, `heb-stack call primes.check` in a terminal, an MCP tool at `/mcp`, and `check` on the capnweb API at `/rpc`.

## Start a project

```sh
gh repo clone Hebilicious/heb-stack <name>
```

Then install and verify:

```sh
proto install                # proto, moon, Node, pnpm and Rust, pinned in .prototools
pnpm install
moon run app:verify          # every check and every proof
moon run app:hooks-install   # gommage on commit messages, formatting on commit, lint and types on push
```

## Workspace layout

| Path | Project | Role |
| --- | --- | --- |
| `apps/web` | `web` | The Vapor page, built by Vite and vize, styled with cssforge tokens |
| `workers/api` | `api` | The Alchemy stack: one Worker serving the page, `/rpc` and `/mcp` |
| `packages/application-primes` | `application-primes` | The domain: capabilities, the check machine, `PrimeMath`, `CheckHistory` |
| `packages/acidcat` |  | The root that composes domains into the one catalog |
| `packages/acidcat-kernel` |  | Capability types and the catalog walk every adapter shares |
| `packages/browser-runtime` |  | The page's Layers: math over capnweb, history in browser storage, WebMCP |
| `packages/node-runtime` |  | The Node host: the crate in-process, history in a JSON file |
| `packages/edge-runtime` |  | The Worker host: the crate compiled once per isolate, no history |
| `packages/cli` | `cli` | `heb-stack list` and `heb-stack call`, on Effect's CLI |
| `packages/mcp` |  | `effect/ai/McpServer` over stateless HTTP |
| `packages/rpc` |  | The capnweb `PrimesApi` |
| `packages/webmcp-adapter` |  | Registers the catalog as in-page WebMCP tools |
| `crates/primes` | `primes` | `smallest_factor(u64) -> u64`, compiled to WebAssembly |
| `features` | `features` | Gherkin features and adapter proofs |
| `e2e` | `e2e` | The Playwright scenario |
| `tools/oxlint/anti-slop` |  | Vendored anti-slop rules and this repository's Effect rules |

Every package has a README that says what it does.

## Try it

Run the page, `/rpc` and `/mcp` locally. Nothing here needs a Cloudflare account:

```sh
moon run app:dev            # rebuilds the page and serves it on http://localhost:1337
```

Type 91 and the page answers `91 = 7 × 13`; type 97 and it answers `97 is prime`. In a Chromium build with WebMCP enabled (`--enable-features=WebMCP`), the same catalog is registered as tools on `document.modelContext`.

The same capability from a terminal:

```sh
moon run cli:install
.artifacts/bin/heb-stack call primes.check '{"n":97}' --json
.artifacts/bin/heb-stack call primes.next '{"after":97}'
.artifacts/bin/heb-stack list
```

And from an MCP client, posting to `/mcp`:

```http
POST /mcp
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: primes.check
```

## The demo

| Capability | Kind | Answers | Fails with | Served to |
| --- | --- | --- | --- | --- |
| `primes.check` | query | `{ n, prime, smallestFactor }` | `OutOfRange { n, min, max }` | web, cli, mcp, rpc |
| `primes.next` | query | `{ after, prime }` | `OutOfRange` | web, cli, mcp, rpc |
| `history.list` | query | `{ entries }`, at most 20, newest first | — | web, cli |
| `history.clear` | command | `{ cleared }` | `StorageUnavailable { reason }` | web, cli |

A capability reaches a surface only when its own `audience` names it. The Worker keeps no caller state, so MCP and capnweb neither list the history nor reach it by name.

The check lifecycle is `idle → checking → result | failed`. A new number interrupts the check in flight, and checking the number that just failed retries it. The owner runs the machine; the page reads its snapshot through an atom.

## AcidCat

**AcidCat** is the name of the application interface: the one typed catalog of capabilities that every surface reaches. It is a name, not an acronym. The project it comes from defines it by its specification and deliberately does not expand it into letters.

- A domain package owns its capabilities and exports only their definitions. Only `packages/acidcat` imports a domain package; `anti-slop-effect/no-application-bypass` fails the lint if anything else does.
- Each host supplies Layers and nothing else: the browser, Node and the Worker each provide `PrimeMath`, and `CheckHistory` where they keep one.
- Adapters walk the catalog. None of them holds a capability map, so a new leaf reaches a surface by naming it in its audience.
- An external call decodes its input with the leaf's schema and answers a `Result`, so a typed failure such as `OutOfRange` travels as data, and a defect fails the call instead.

## What is in the stack?

- **Moon `2.5.6` and proto `0.62.3`**: every operation is a Moon task in the project it belongs to; proto pins Node `26.10.0`, pnpm `12.8.1`, Rust `1.99.0` and Moon itself.
- **Effect `4.0.0`**: services and Layers, typed failures, Schema for every contract, `effect/cli` for the command line, and `effect/ai/McpServer` for MCP.
- **XState `6.0.0-alpha.63` with `@xstate/effect` `0.1.0-alpha.6`**: the check lifecycle as a machine, with its work as an invoked Effect.
- **Vue `3.6.0-rc.10` in Vapor mode** with **`@effect/atom-vue` `4.0.0`**: `<script setup vapor lang="ts">`, compiled by **vize `0.429.2`**, bundled by **Vite `8.3.2`**, styled with **cssforge `0.9.0`** tokens.
- **capnweb `0.12.0`**: the API at `/rpc`, called by the page over HTTP batches.
- **Alchemy `2.0.0-beta.79`**: the Worker declared as an Effect program; `alchemy dev` runs it in workerd locally.
- **Rust**: one crate compiled to `wasm32-unknown-unknown`, behind one typed port.
- **Vitest `5.0.3`, Gherkin (`@cucumber/gherkin` `42.0.1`) and Playwright `1.63.0`**: features whose steps return Effects, run by a manifest runner on Vitest, and one browser scenario.
- **TypeScript `7.0.2` and `@effect/tsgo` `0.47.2`**: strict types, and Effect language-service diagnostics as a gate.
- **Ultracite `7.12.2` on Oxlint `1.86.0` and Oxfmt `0.71.0`**: Ultracite's presets, with the vendored anti-slop rules and this repository's Effect rules on top, type-aware.
- **gommage `0.1.0` and lefthook `2.1.15`**: no AI attribution in commit history; format on commit, lint and types on push.

Every dependency is pinned exactly, once, in the catalog in `pnpm-workspace.yaml`.

## Commands

| Command | Purpose |
| --- | --- |
| `moon run app:verify` | Every check and every proof |
| `moon run app:dev` | The page, `/rpc` and `/mcp` on <http://localhost:1337> |
| `moon run :lint` / `moon run :typecheck` | Lint or type-check every project |
| `moon run :format` / `:format-check` | Format TypeScript, Vue and Rust, or check it |
| `moon run features:test` | The Gherkin features and the adapter proofs |
| `moon run e2e:test` | The browser scenario against `alchemy dev` |
| `moon run primes:test` | The crate's tests |
| `moon run cli:install` | Build the CLI and write `.artifacts/bin/heb-stack` |
| `moon run api:deploy -- --stage <name>` | Deploy a stage as its own `heb-stack-<stage>` Worker |
| `moon run app:authorship-fix -- <range>` | Strip AI attribution from the commits in a range |

Deploying needs an Alchemy profile: run `pnpm exec alchemy profile edit --add Cloudflare` once in `workers/api`. No account, zone or route lives in the repository.

## Evidence

| Seam | Proof |
| --- | --- |
| Capabilities | `features/primes/primes.feature`, over the compiled crate |
| Targets | `features/primes/targets.feature`: each adapter lists exactly its leaves; MCP refuses history |
| The page | `features/web/check.vue.feature`: typing 91 shows "91 = 7 × 13" |
| The lifecycle | `packages/application-primes/src/checker.test.ts`: replacement interrupts; a failed check retries |
| CLI and MCP | `features/adapters/`: the built binary in a process; `tools/list` and `tools/call` |
| Browser | `e2e/check.e2e.ts`: a check over capnweb, and the history after a reload |
| Rust | `crates/primes/tests`: 2, 97, 91 and 2^53 − 111 |

Deadlines are hang guards, never paces, and nothing retries.

## Make it yours

Rename the `@heb-stack/*` packages, then replace `packages/application-primes` with your own domain: define its capabilities in `capabilities.ts`, its lifecycle in a `*-machine.ts`, and its services as Effect `Context.Service`s. Compose it in `packages/acidcat`, give each host its Layers, and every surface serves it.

---

Inspired by [rat-stack](https://github.com/joelhooks/rat-stack).
