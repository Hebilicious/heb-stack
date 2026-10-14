# @heb-stack/browser-runtime

The page's host: the Layers a browser session supplies, and WebMCP discovery.

- `PrimeMathRemote` asks the Worker for each factor over capnweb.
- `CheckHistoryLocal` keeps the history in browser storage, so it survives a reload.
- `discoverModelContext` finds the document's WebMCP host. With one, the session registers its tools there through `@acid-cat/core-effect`; without one, it registers nothing.

`createBrowserAcidCat` opens the `web` session with all three.
