# @heb-stack/acidcat

AcidCat (Application Capability IDentification Category) is the application interface: identified capabilities, grouped by namespace. This package is its root: the only package that composes domain packages into the one application, built on [`@acid-cat/core-effect`](https://www.npmjs.com/package/@acid-cat/core-effect).

- `app` (`src/catalog.ts`) is the application: its targets (`web`, `cli`, `mcp`, `rpc`) with their bindings, and the `primes` namespace from `packages/primes`. `moon run acidcat:catalog` writes it to `/acidcat.catalog.json` with `App.render`.
- `acidCatLayer(services)` adds the domain's owners to the Layers a host supplies (`PrimeMath`, and `CheckHistory` when the host keeps one). Effect hosts, such as the CLI and the Worker's MCP endpoint, give it to the bindings of `@acid-cat/core-effect`.
- `openAcidCat(services, { target, webmcp })` opens a session for code without Effect: its handles by id, a typed tree that mirrors the ids (`catalog.primes.check`), and, given a host, its WebMCP tools. A capability outside the target's view is never available, and a call to it fails as an unknown capability. `dispose` releases everything together.
- `openSession(app, layer, options)` is the same session for any application, which the conformance evidence uses.
- `@heb-stack/acidcat/primes` exports the services and contracts a host needs to supply, never the owners.
