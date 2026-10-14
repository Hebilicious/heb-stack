# @heb-stack/node-runtime

The Node host: `nodeServices({ wasmPath, historyFile })` is a session's services, with the crate compiled in this process and the history in a JSON file (`$XDG_STATE_HOME/heb-stack/history.json` by default, or none). `@heb-stack/node-runtime/bundle` is the Vite config that turns a Node binding into one `main.js`.
