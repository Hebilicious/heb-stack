# Engineering rules

## Effect

Before writing any Effect code, read `node_modules/effect/AGENTS.md` completely and follow its links when required. For anything it does not cover, read the source in `node_modules/effect/src` rather than external documentation.

## Architecture

- AcidCat (Application Capability IDentification Category) is the application interface. A domain package, such as `packages/primes`, owns one namespace: its capabilities, machines and services, with ids that begin with the namespace. Domains are listed in `settings.acidcat` of `oxlint.config.ts`, and `packages/acidcat` is the only package that composes them; every adapter (Vue, WebMCP, the CLI, MCP, capnweb) depends on the root catalog, never on a domain implementation. Read [the AcidCat notes in the README](README.md#acidcat) before adding a capability or an adapter.
- A capability reaches a target only when its own `audience` names it. Widen a surface by editing that one list.
- XState owns lifecycle, concurrency, replacement, retry and cancellation. Effect owns computations, expected failures, services and resources. Vue observes owner snapshots through `@effect/atom-vue` and keeps only presentation state.
- Keep capability definitions in `capabilities.ts`, `*-capability.ts` or `*.capabilities.ts`, and machines in `machine.ts`, `*-machine.ts` or `*.machine.ts`.
- Headless code never touches Vue, `window`, `document`, `fetch`, `localStorage` or other browser globals. Browser, Node and Worker capabilities arrive as Effect services implemented in `packages/browser-runtime`, `packages/node-runtime` and `packages/edge-runtime`.
- Keep one implementation of each rule, codec and formatter; callers import it rather than restating it.
- Treat storage, network, URL and file data as `unknown` and decode it with Effect Schema before it becomes application state. Mark the place that does so with a `BOUNDARY:` comment, and justify every type assertion with `SAFETY:`.
- Expected failures are typed values in Effect's error channel, encoded through the capability's own error schema.
- Rust earns its place where it is faster or better suited; expose it to TypeScript through one small typed port.

## Tooling

- Every operation is a Moon task in the `moon.yml` of the project it belongs to; the root `moon.yml` holds only repository-wide checks and `verify`. Do not add `package.json` scripts. Run `moon run <project>:<task>`; use `pnpm` directly only for dependency management.
- Every dependency is pinned exactly, once, in the `catalog` of `pnpm-workspace.yaml`; packages name `catalog:`, and overrides point at the catalog too.
- TypeScript only: no JavaScript files, no `any`, no `@ts-ignore`. Vue components use `<script setup vapor lang="ts">`.
- `oxlint` lints with Ultracite's presets plus the anti-slop and Effect rules, and `oxfmt` formats with Ultracite's settings; `vize` formats, lints and type-checks Vue. Do not introduce ESLint or Prettier. A rule is disabled only on the line it concerns, with its reason after `--`.
- Lefthook checks each commit message with gommage, formatting on commit, and lint and type checks on push. Install it with `moon run app:hooks-install`, and fix what it reports instead of bypassing it.
- Commits and pull requests carry no AI attribution. `moon run app:authorship-fix -- <range>` strips it from commits that already have it.

## Evidence

- Behaviour is stated in Gherkin under `features/`, and each step returns its Effect to the runner, which runs it in the scenario's Scope. Plain tests use `testEffect`. Never run an Effect or build a runtime by hand in evidence.
- Evidence fails only for a reason a change controls: no wall-clock budgets, no retries, no widened expectations to reach green. A deadline is a hang guard far above healthy latency, never a pace.
- Report a failing command with its exact invocation, exit code and output before drawing a conclusion.

## Working in the repository

- Use Git to inspect every change: `git status` before editing and `git diff` afterwards. Preserve unrelated work and never run destructive Git commands. Work on a branch, not on `main`.
- A dev server you start takes an unused port. Leave every server you did not start alone.
- Keep secrets, account IDs and personal data out of the repository; Alchemy reads the account from its own profile (`pnpm exec alchemy profile`). `moon run api:dev` runs locally with no account. Deploying a stage creates a live Worker, so it is a separate, deliberate decision.
