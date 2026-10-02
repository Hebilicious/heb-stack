# @heb-stack/node-runtime

The Node host: `createNodeAcidCat({ target, wasmPath, historyFile })` opens a session with the crate compiled in this process and the history in a JSON file (`$XDG_STATE_HOME/heb-stack/history.json` by default, or none). `@heb-stack/node-runtime/bundle` is the Vite config that turns a Node adapter into one `main.js`.
