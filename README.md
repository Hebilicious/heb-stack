<div align="center">

# 🐱 heb-stack

**One [AcidCat](https://github.com/Hebilicious/acidcat) capability catalog. Five surfaces. Zero duplicated wiring.**

_A fence that makes the shortcut the wrong path._

[![AcidCat](https://img.shields.io/npm/v/@acid-cat/core-effect?label=%F0%9F%90%B1%20acidcat&color=8b5cf6)](https://github.com/Hebilicious/acidcat) [![Effect](https://img.shields.io/badge/Effect-4.0-000000?logo=typescript&logoColor=white)](https://effect.website) [![XState](https://img.shields.io/badge/XState-6%20alpha-2c3e50?logo=xstate&logoColor=white)](https://stately.ai/docs/xstate) [![Vue Vapor](https://img.shields.io/badge/Vue-3.6%20Vapor-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org) [![cssforge](https://img.shields.io/badge/cssforge-0.9-ff6b9d)](https://cssforge.hebilicious.workers.dev) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com) [![Rust → Wasm](https://img.shields.io/badge/Rust-WebAssembly-dea584?logo=rust&logoColor=white)](crates/primes) [![MCP](https://img.shields.io/badge/MCP-2026--07--28-black?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io) [![Moon](https://img.shields.io/badge/moon-2.5-6f53f3)](https://moonrepo.dev) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[🌐 Live preview](https://heb-stack-preview.hebilicious.workers.dev) · [🐱 AcidCat](#-built-on-acidcat) · [🧰 Why these libraries](#-why-these-libraries) · [🚀 Start](#-start-a-project)

</div>

---

heb-stack is a starter for an **Effect** application on **Cloudflare**, built on **[AcidCat](https://github.com/Hebilicious/acidcat)**. You define a **capability** once (Effect Schema input, output and failure, plus one Effect computation), its owner runs the lifecycle in an XState machine, and AcidCat serves it to every surface from one catalog:

|  | Surface | How it gets there |
| --- | --- | --- |
| 🖥️ | **A Vue Vapor page** | over capnweb to the Worker |
| 🤖 | **An agent in the page** | WebMCP tools on `document.modelContext` |
| ⌨️ | **A terminal** | `cli`, every command derived from the catalog |
| 🔌 | **An MCP client** | `/mcp`, stateless revision `2026-07-28` |
| 📡 | **Code** | a typed capnweb API at `/rpc` |

The demo is a prime checker, kept as small as the wiring allows. A preview runs at <https://heb-stack-preview.hebilicious.workers.dev>: the page, with `/mcp` and `/rpc` beside it.

## 🐱 Built on AcidCat

**AcidCat** (**A**pplication **C**apability **ID**entification **Cat**egory) is the application interface of this stack. It is one typed catalog of capabilities, each with a stable identifier inside a category, and every surface reaches the application through it, and only through it.

heb-stack follows [the AcidCat specification](https://github.com/Hebilicious/acidcat) and is built on its published packages:

| Package | What it does here |
| --- | --- |
| [`@acid-cat/core-effect`](https://www.npmjs.com/package/@acid-cat/core-effect) | Serves the capabilities, and provides the CLI, MCP and WebMCP bindings |
| [`@acid-cat/cli`](https://www.npmjs.com/package/@acid-cat/cli) | `acid-cat check --strict` on the catalog, and `acid-cat conform` on the bindings |
| [`@acid-cat/catalog`](https://www.npmjs.com/package/@acid-cat/catalog) · [`@acid-cat/spec-ts`](https://www.npmjs.com/package/@acid-cat/spec-ts) | The catalog document and the specification's types |

### 🗂️ The catalog

The category is the **namespace**. This catalog defines exactly one, `primes`, owned by `packages/primes`. Every id begins with it, and the catalog tree mirrors the ids:

| Capability | Read-only | Answers | Fails with | Served to |
| --- | --- | --- | --- | --- |
| `primes.check` | ✅ | `{ n, prime, smallestFactor }` | `OutOfRange { n, min, max }` | web, cli, mcp, rpc |
| `primes.next` | ✅ | `{ after, prime }` | `OutOfRange` | web, cli, mcp, rpc |
| `primes.history.list` | ✅ | `{ entries }`, the 20 newest checks, newest first | — | web, cli |
| `primes.history.clear` | ❌ | `{ cleared }` | `StorageUnavailable { reason }` | web, cli |

A second domain would add its own namespace beside `primes`, in its own package.

The catalog is also a document: [`acidcat.catalog.json`](acidcat.catalog.json), which `App.render` writes from the application in canonical form. `moon run acidcat:catalog` rewrites it, and `moon run app:verify` fails when the committed file is stale or when `acid-cat check --strict` refuses it.

### 🧱 The rules AcidCat enforces here

- 🏠 **A domain owns its namespace** and exports only its definitions. Only `packages/acidcat` imports it; `anti-slop-effect/no-application-bypass` fails the lint if anything else does. The domains are declared once, in `settings.acidcat` of `oxlint.config.ts`.
- 🎯 **A capability reaches a surface only when its own `audience` names it.** Widen a surface by editing that one list.
- 🔌 **Each host supplies Layers and nothing else**: the browser, Node and the Worker each provide `PrimeMath`, and `CheckHistory` where they keep one.
- 🪄 **Bindings hold no capability map.** They come from `@acid-cat/core-effect`: the CLI's commands and flags, the MCP tools and the WebMCP tools are all derived from the capabilities and their schemas. `hs:capnweb`, the capnweb API, is this application's own binding, over the `rpc` session's handles.
- 🧾 **Every external call has one outcome.** Its input is decoded with the capability's schema, and it ends with a value, a failure such as `OutOfRange` (which travels as data), or a call failure (`unknown-capability`, `unavailable`, `invalid-input`, `cancelled`, `internal`) that each binding reports in its own form.
- ✅ **Conformance is proven, not claimed.** `features/adapters/conformance.test.ts` runs `acid-cat conform` against this repository's own MCP, CLI and WebMCP hosting, serving the specification's conformance fixture.

The check lifecycle is `idle → checking → result | failed`. A new number interrupts the check in flight, and checking the number that just failed retries it. The owner runs the machine, `primes.check` publishes its snapshots as its `state`, and the page reads them through an atom.

## 🌈 One capability, every surface

`primes.check` is defined once, in `packages/primes/src/capabilities.ts`. Here it is on each surface, against `moon run app:dev`. Each example is condensed from a test in this repository, or was run as written.

### 🖥️ The page

Driven by Playwright (`e2e/check.e2e.ts`). The check travels to the Worker over capnweb:

```ts
await page.goto("/");
await page.getByLabel("Number").fill("91");
await expect(page.getByRole("status")).toHaveText("91 = 7 × 13");
```

### 🤖 An agent in the page

Through WebMCP (`e2e/webmcp.e2e.ts`, Chromium with `--enable-features=WebMCP`). The catalog is registered as tools on `document.modelContext`:

```ts
const answer = await page.evaluate(async () => {
  const tools = await document.modelContext.getTools();
  const next = tools.find((tool) => tool.name === "primes.next");
  return document.modelContext.executeTool(next, '{"after":97}');
});
// '{"ok":true,"value":{"after":97,"prime":101}}'
```

### ⌨️ A terminal

With `cli`. Every leaf is a command derived from the catalog, and every answer is JSON (indented in the terminal, one line each here):

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
$ cli call primes.check '{"n":"x"}'; echo "exit $?"   # a call failure, on standard error
{"kind":"invalid-input","message":"n: Expected number"}
exit 3
$ cli list   # every capability with its availability and usage, as JSON
```

### 🔌 An MCP client

At `/mcp` (stateless revision `2026-07-28`):

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

### 📡 Code

Over capnweb at `/rpc`:

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

> [!NOTE] The MCP endpoint and the API run in a shared Worker that keeps no caller state, so they never list `primes.history.*`, and a call by name is refused: `Tool 'primes.history.clear' not found`.

## 🧰 Why these libraries

Each library has one job, and the boundaries between them are rules of the repository, not suggestions.

|  | Choice | Why it is here |
| --- | --- | --- |
| 🐱 | **AcidCat `0.6.1`** | The application interface. One catalog replaces a hand-written route table, CLI parser, MCP tool list and WebMCP registration: the bindings are derived from the capabilities' schemas, so adding a capability adds it everywhere its `audience` allows, and `acid-cat conform` proves each binding behaves. |
| ⚡ | **Effect `4.0.0`** | Computations, expected failures, services and resources. Failures are typed values in the error channel, Schema decodes every contract and every untrusted input, and Layers let the browser, Node and the Worker each supply their own `PrimeMath` and `CheckHistory` behind the same service. `@acid-cat/core-effect` builds its CLI on `effect/cli` and its MCP server on `effect/ai/McpServer`, so there is no second framework underneath. |
| 🚦 | **XState `6.0.0-alpha.63`** + **`@xstate/effect` `0.1.0-alpha.6`** | Lifecycle, concurrency, replacement, retry and cancellation. These are state, not computation, so they live in a machine whose work is an invoked Effect. Interrupting the check in flight and retrying the one that failed are transitions, tested as such. |
| 💚 | **Vue `3.6.0-rc.10` in Vapor mode** + **`@effect/atom-vue` `4.0.0`** | Presentation only. Vapor compiles `<script setup vapor lang="ts">` to direct DOM updates with no virtual DOM, and the page observes the owner's snapshots through an atom instead of keeping its own copy of application state. |
| 🧩 | **vize `0.429.2`** | Formats, lints and type-checks Vue in one tool, and compiles it for **Vite `8.3.2`**. |
| 🎨 | **[cssforge](https://cssforge.hebilicious.workers.dev) `0.9.0`** + **`@hebilicious/cssforge-unplugin` `0.1.1`** | Design tokens with zero runtime. Colours, spacing, fonts and a fluid type scale are declared once, typed, in `apps/web/cssforge.config.ts`; colours become OKLCH ramps whose steps read the same across families. The Vite plugin generates the token stylesheet inside the build as `virtual:cssforge.css`, so a token edit restyles the page with no generation step and no committed token stylesheet, and `page.css` consumes plain custom properties such as `var(--palette-ink-950)`. |
| 📡 | **capnweb `0.12.0`** | A typed object-capability RPC between the page and the Worker, with HTTP batching, and no schema or code generation step. |
| ☁️ | **Alchemy `2.0.0-beta.81`** | Infrastructure as an Effect program: one Worker serves the page, `/rpc` and `/mcp`, and `alchemy dev` runs it in workerd locally with no Cloudflare account. |
| 🦀 | **Rust → WebAssembly** | Rust earns its place where it is faster or better suited. One crate, `smallest_factor(u64) -> u64`, compiled to `wasm32-unknown-unknown` and exposed to TypeScript through one small typed port. |
| 🥒 | **Vitest `5.0.3`**, **Gherkin** (`@cucumber/gherkin` `42.0.1`), **Playwright `1.63.0`** | Behaviour is stated in Gherkin, and each step returns its Effect to a manifest runner on Vitest, which runs it in the scenario's Scope. Playwright drives the page and the WebMCP scenario. |
| 🔷 | **TypeScript `7.0.2`** + **`@effect/tsgo` `0.47.2`** | The native TypeScript compiler, with Effect's language-service diagnostics as a gate rather than a hint. |
| 🧹 | **Ultracite `7.12.2`** on **Oxlint `1.86.0`** and **Oxfmt `0.71.0`** | Fast, type-aware linting and formatting, with vendored anti-slop rules and this repository's Effect rules on top. These rules are what make bypassing AcidCat a lint error. No ESLint, no Prettier. |
| 🌙 | **Moon `2.5.6`** + **proto `0.62.3`** | Every operation is a Moon task in the project it belongs to, cached and ordered by the project graph. proto pins Node `26.10.0`, pnpm `12.8.1`, Rust `1.99.0` and Moon itself. |
| 🪝 | **gommage `0.1.0`** + **lefthook `2.1.15`** | No AI attribution in commit history; format on commit, lint and types on push. |

Every dependency is pinned exactly, once, in the catalog in `pnpm-workspace.yaml`.

## 🚀 Start a project

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

## 🗺️ Workspace layout

| Path | Moon project | Role |
| --- | --- | --- |
| `packages/primes` | `primes` | 🔢 The `primes` namespace: capabilities, the check machine, the services |
| `packages/acidcat` | `acidcat` | 🐱 The root that composes namespaces into the one application, its sessions and its catalog |
| `apps/web` | `web` | 🖥️ The Vapor page, built by Vite and vize, styled with [cssforge](https://cssforge.hebilicious.workers.dev) tokens |
| `packages/cli` | `cli` | ⌨️ `cli`, the CLI binding of `@acid-cat/core-effect`, with the session's flags |
| `packages/rpc` |  | 📡 The capnweb `PrimesApi` |
| `packages/browser-runtime` |  | 🌐 The page's Layers: math over capnweb, history in browser storage, WebMCP discovery |
| `packages/node-runtime` |  | 🟢 The Node host: the crate in-process, history in a JSON file |
| `packages/edge-runtime` |  | ☁️ The Worker host: the crate compiled once per isolate, no history, a session per request for `/mcp` and `/rpc` |
| `workers/api` | `api` | 🏗️ The Alchemy stack: one Worker serving the page, `/rpc` and `/mcp` |
| `crates/primes` | `primes-wasm` | 🦀 `smallest_factor(u64) -> u64`, compiled to WebAssembly |
| `features` | `features` | 🥒 Gherkin features and adapter proofs |
| `e2e` | `e2e` | 🎭 The Playwright scenarios: the page, and WebMCP |
| `tools/oxlint/anti-slop` |  | 🧹 Vendored anti-slop rules and this repository's Effect rules |

Every package has a README that says what it does.

## 🛠️ Commands

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
| `moon run acidcat:catalog` | Rewrite `acidcat.catalog.json` from the application |
| `moon run api:deploy -- --stage <name>` | Deploy a stage as its own `heb-stack-<stage>` Worker |
| `moon run app:authorship-fix -- <range>` | Strip AI attribution from the commits in a range |

> [!TIP] Deploying needs an Alchemy profile: run `pnpm exec alchemy profile edit --add Cloudflare` once in `workers/api`. No account, zone or route lives in the repository.

## 🔬 Evidence

| Seam | Proof |
| --- | --- |
| Capabilities | `features/primes/primes.feature`, over the compiled crate |
| Targets | `features/primes/targets.feature`: each adapter lists exactly its leaves; MCP refuses the history; capnweb refuses a batch that is not UTF-8 |
| The page | `features/web/check.vue.feature`: typing 91 shows "91 = 7 × 13" |
| The lifecycle | `packages/primes/src/checker.test.ts`: replacement interrupts; a failed check retries |
| CLI and MCP | `features/adapters/`: `cli` in a process; `tools/list` and `tools/call` |
| Conformance | `features/adapters/conformance.test.ts`: `acid-cat conform` against the MCP, CLI and WebMCP hosting |
| Browser | `e2e/check.e2e.ts` and `e2e/webmcp.e2e.ts`: a check over capnweb and a reload; a WebMCP call |
| Rust | `crates/primes/tests`: 2, 97, 91 and 2^53 − 111 |

Deadlines are hang guards, never paces, and nothing retries.

## 🎨 Make it yours

Rename the `@heb-stack/*` packages, then replace `packages/primes` with your own namespace:

1. Define its capabilities in `capabilities.ts`, with ids that begin with the namespace.
2. Put its lifecycle in a `*-machine.ts`, and its services in Effect `Context.Service`s.
3. Compose it in `packages/acidcat` and list it in `settings.acidcat.domains`.
4. Give each host its Layers.

Every surface then serves it, `cli <namespace> …` included. 🎉

## 📄 License

[MIT](LICENSE).

---

<div align="center">

Inspired by [rat-stack](https://github.com/joelhooks/rat-stack) · Powered by 🐱 [AcidCat](https://github.com/Hebilicious/acidcat)

</div>
