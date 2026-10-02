# @heb-stack/webmcp-adapter

Publishes the catalog to agents in the page through WebMCP (`document.modelContext.registerTool`).

The adapter walks the catalog, registers each available leaf with the description and JSON Schema from the build-time manifest, and reconciles registrations when availability changes. It holds no capability map: a new leaf is registered without a change here. `@heb-stack/webmcp-adapter/manifest` derives that manifest from the definitions, so JSON Schema conversion never ships to the browser.
