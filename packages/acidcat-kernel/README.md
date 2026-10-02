# @heb-stack/acidcat-kernel

The types and walks every AcidCat package shares, with no domain in them.

- `defineCapability` declares a leaf: its id, description, audience of targets, and a program of Effect Schema input, output and error plus one computation.
- `SessionTarget` names who a session is for: `web`, `cli`, `mcp` or `rpc`.
- `walkCatalogEntries`, `walkCapabilities` and `servedCapabilities` are the one catalog walk every adapter uses, so no adapter keeps a capability map.
- `ReadonlySnapshotSource` is how an owner publishes state for Vue to observe.
- `@heb-stack/acidcat-kernel/bounded-body` reads a request body up to a byte bound, for the HTTP adapters.
