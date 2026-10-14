# heb-stack

_One capability catalog, five surfaces, and a fence that makes the shortcut the wrong path._

A starter for an Effect application on Cloudflare. It ships as a **pnpm + Moon workspace** with a Vue Vapor page, in-page WebMCP tools, a command line, an MCP endpoint, a capnweb API, and a Rust crate compiled to WebAssembly. The demo is a prime checker, kept as small as the wiring allows.

The shape it teaches: define a **capability** once (Effect Schema input, output and failure, plus one Effect computation), let its owner run the lifecycle in an XState machine, and serve it to every surface from one catalog.

A preview runs at <https://heb-stack-preview.hebilicious.workers.dev>: the page, with `/mcp` and `/rpc` beside it.

## One capability, every surface

`primes.check` is defined once, in `packages/primes/src/capabilities.ts`. Here it is on each surface, against `moon run app:dev`. Each example is condensed from a test in this repository, or was run as written.

**The page**, driven by Playwright (`e2e/check.e2e.ts`). The check travels to the Worker over capnweb:

```ts
await page.goto("/");
await page.getByLabel("Number").fill("91");
await expect(page.getByRole("status")).toHaveText("91 = 7 × 13");
```

**An agent in the page**, through WebMCP (`e2e/webmcp.e2e.ts`, Chromium with `--enable-features=WebMCP`). The catalog is registered as tools on `document.modelContext`:

```ts
const answer = await page.evaluate(async () => {
  const tools = await document.modelContext.getTools();
  const next = tools.find((tool) => tool.name === "primes.next");
  return document.modelContext.executeTool(next, '{"after":97}');
});
// '{"ok":true,"value":{"after":97,"prime":101}}'
```

**A terminal**, with `cli`. Every leaf is a command derived from the catalog, and every answer is JSON (indented in the terminal, one line each here):

```sh
$ moon run cli:install
$ alias cli=.artifacts/bin/cli
$ cli primes check --n 91
{ "n": 91, "prime": false, "smallestFactor": 7 }
$ cli primes next --after=97
{ "after": 97, "prime": 101 }
$ cli primes history list
{ "entries": [{ "checkedAt": "2026-10-07T06:51:24.475Z", "n": 91, "prime": false }] }
$ cli call primes.check '{"n":1}'; echo "exit $?"
{ "_tag": "OutOfRange", "max": 9007199254740991, "min": 2, "n": 1 }
exit 1
$ cli list   # every command with its usage, as JSON
```

**An MCP client**, at `/mcp` (stateless revision `2026-07-28`):

```sh
curl -s http://localhost:1337/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/call' \
  -H 'Mcp-Name: primes.check' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"primes.check","arguments":{"n":91},"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}'
# result.structuredContent: {"n":91,"prime":false,"smallestFactor":7}
```

**Code**, over capnweb at `/rpc`:

```ts
import type { PrimesApi } from "@heb-stack/rpc";
import { newHttpBatchRpcSession } from "capnweb";

const api = newHttpBatchRpcSession<PrimesApi>(
  new Request("http://localhost:1337/rpc", {
    headers: { Origin: "http://localhost:1337" },
    method: "POST",
  })
);
await api.check({ n: 91 });
// { ok: true, value: { n: 91, prime: false, smallestFactor: 7 } }
```

The MCP endpoint and the API run in a shared Worker that keeps no caller state, so they never list `primes.history.*`, and a call by name is refused: `Tool 'primes.history.clear' not found`.

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
moon run app:dev             # the page, /rpc and /mcp on http://localhost:1337, with no Cloudflare account
```

## AcidCat

**AcidCat** stands for **Application Capability IDentification Category**. It is the application interface: one typed catalog of capabilities, each with a stable identifier inside a category, which every surface reaches.

The category is the **namespace**. This catalog defines exactly one, `primes`, owned by `packages/primes`. Every id begins with it, and the catalog tree mirrors the ids:

| Capability | Kind | Answers | Fails with | Served to |
| --- | --- | --- | --- | --- |
| `primes.check` | query | `{ n, prime, smallestFactor }` | `OutOfRange { n, min, max }` | web, cli, mcp, rpc |
| `primes.next` | query | `{ after, prime }` | `OutOfRange` | web, cli, mcp, rpc |
| `primes.history.list` | query | `{ entries }`, at most 20, newest first | — | web, cli |
| `primes.history.clear` | command | `{ cleared }` | `StorageUnavailable { reason }` | web, cli |

A second domain would add its own namespace beside `primes`, in its own package.

The catalog is also a document: [`acidcat.catalog.json`](acidcat.catalog.json), written from the same definitions in the canonical form of the [AcidCat specification](https://github.com/Hebilicious/acidcat). `moon run web:catalog` rewrites it, and `moon run app:verify` fails when the committed file is stale or when `acid-cat check --strict` refuses it.

- A domain package owns its namespace and exports only its definitions. Only `packages/acidcat` imports it; `anti-slop-effect/no-application-bypass` fails the lint if anything else does. The domains are declared once, in `settings.acidcat` of `oxlint.config.ts`.
- A capability reaches a surface only when its own `audience` names it.
- Each host supplies Layers and nothing else: the browser, Node and the Worker each provide `PrimeMath`, and `CheckHistory` where they keep one.
- Adapters walk the catalog. None of them holds a capability map: the CLI's commands and flags, the MCP tools and the WebMCP tools are all derived from the leaves and their schemas.
- An external call decodes its input with the leaf's schema and answers a `Result`, so a typed failure such as `OutOfRange` travels as data, and a defect fails the call instead.

The check lifecycle is `idle → checking → result | failed`. A new number interrupts the check in flight, and checking the number that just failed retries it. The owner runs the machine; the page reads its snapshot through an atom.

## Workspace layout

| Path | Moon project | Role |
| --- | --- | --- |
| `packages/primes` | `primes` | The `primes` namespace: capabilities, the check machine, the services |
| `packages/acidcat` |  | The root that composes namespaces into the one catalog |
| `packages/acidcat-kernel` |  | Capability types and the catalog walk every adapter shares |
| `apps/web` | `web` | The Vapor page, built by Vite and vize, styled with cssforge tokens |
| `packages/webmcp-adapter` |  | Registers the catalog as in-page WebMCP tools |
| `packages/cli` | `cli` | `cli`, on Effect's CLI, with commands derived from the catalog |
| `packages/mcp` |  | `effect/ai/McpServer` over stateless HTTP |
| `packages/rpc` |  | The capnweb `PrimesApi` |
| `packages/browser-runtime` |  | The page's Layers: math over capnweb, history in browser storage, WebMCP |
| `packages/node-runtime` |  | The Node host: the crate in-process, history in a JSON file |
| `packages/edge-runtime` |  | The Worker host: the crate compiled once per isolate, no history |
| `workers/api` | `api` | The Alchemy stack: one Worker serving the page, `/rpc` and `/mcp` |
| `crates/primes` | `primes-wasm` | `smallest_factor(u64) -> u64`, compiled to WebAssembly |
| `features` | `features` | Gherkin features and adapter proofs |
| `e2e` | `e2e` | The Playwright scenarios: the page, and WebMCP |
| `tools/oxlint/anti-slop` |  | Vendored anti-slop rules and this repository's Effect rules |

Every package has a README that says what it does.

## What is in the stack?

- **Moon `2.5.6` and proto `0.62.3`**: every operation is a Moon task in the project it belongs to; proto pins Node `26.10.0`, pnpm `12.8.1`, Rust `1.99.0` and Moon itself.
- **Effect `4.0.0`**: services and Layers, typed failures, Schema for every contract, `effect/cli` for the command line, and `effect/ai/McpServer` for MCP.
- **XState `6.0.0-alpha.63` with `@xstate/effect` `0.1.0-alpha.6`**: the check lifecycle as a machine, with its work as an invoked Effect.
- **Vue `3.6.0-rc.10` in Vapor mode** with **`@effect/atom-vue` `4.0.0`**: `<script setup vapor lang="ts">`, compiled by **vize `0.429.2`**, bundled by **Vite `8.3.2`**, styled with **cssforge `0.9.0`** tokens.
- **capnweb `0.12.0`**: the API at `/rpc`, called by the page over HTTP batches.
- **Alchemy `2.0.0-beta.81`**: the Worker declared as an Effect program; `alchemy dev` runs it in workerd locally.
- **Rust**: one crate compiled to `wasm32-unknown-unknown`, behind one typed port.
- **Vitest `5.0.3`, Gherkin (`@cucumber/gherkin` `42.0.1`) and Playwright `1.63.0`**: features whose steps return Effects, run by a manifest runner on Vitest, and two browser scenarios.
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
| `moon run primes:test` | The lifecycle below AcidCat |
| `moon run features:test` | The Gherkin features and the adapter proofs |
| `moon run e2e:test` | The browser scenarios against `alchemy dev` |
| `moon run primes-wasm:test` | The crate's tests |
| `moon run cli:install` | Build the CLI and write `.artifacts/bin/cli` |
| `moon run web:catalog` | Rewrite `acidcat.catalog.json` from the capability definitions |
| `moon run api:deploy -- --stage <name>` | Deploy a stage as its own `heb-stack-<stage>` Worker |
| `moon run app:authorship-fix -- <range>` | Strip AI attribution from the commits in a range |

Deploying needs an Alchemy profile: run `pnpm exec alchemy profile edit --add Cloudflare` once in `workers/api`. No account, zone or route lives in the repository.

## Evidence

| Seam | Proof |
| --- | --- |
| Capabilities | `features/primes/primes.feature`, over the compiled crate |
| Targets | `features/primes/targets.feature`: each adapter lists exactly its leaves; MCP refuses the history; capnweb refuses a batch that is not UTF-8 |
| The page | `features/web/check.vue.feature`: typing 91 shows "91 = 7 × 13" |
| The lifecycle | `packages/primes/src/checker.test.ts`: replacement interrupts; a failed check retries |
| CLI and MCP | `features/adapters/`: `cli` in a process; `tools/list` and `tools/call` |
| Browser | `e2e/check.e2e.ts` and `e2e/webmcp.e2e.ts`: a check over capnweb and a reload; a WebMCP call |
| Rust | `crates/primes/tests`: 2, 97, 91 and 2^53 − 111 |

Deadlines are hang guards, never paces, and nothing retries.

## Make it yours

Rename the `@heb-stack/*` packages, then replace `packages/primes` with your own namespace: define its capabilities in `capabilities.ts` with ids that begin with the namespace, its lifecycle in a `*-machine.ts`, and its services as Effect `Context.Service`s. Compose it in `packages/acidcat`, list it in `settings.acidcat.domains`, give each host its Layers, and every surface serves it, `cli <namespace> …` included.

## License

[MIT](LICENSE).

---

Inspired by [rat-stack](https://github.com/joelhooks/rat-stack).
