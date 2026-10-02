# API Worker

One Cloudflare Worker, declared with Alchemy: the built page as assets, capnweb at `/rpc` and MCP at `/mcp`.

- `src/worker.ts` declares the Worker and its props; `src/routes.ts` handles requests, and loads on the first request so Alchemy can plan in Node.
- `alchemy.run.ts` is the stack. Development keeps state in `.alchemy/`; a deploy sets `HEB_STACK_STATE=cloudflare` and shares the account's Alchemy state store.

| Task | What it does |
| --- | --- |
| `moon run api:dev` | Runs the Worker in workerd on <http://localhost:1337>, with no Cloudflare account |
| `moon run api:plan -- --stage <name>` | Shows what deploying a stage would change |
| `moon run api:deploy -- --stage <name>` | Deploys the stage as its own `heb-stack-<stage>` Worker |
| `moon run api:destroy -- --stage <name>` | Deletes everything the stage created |

Deploying needs an Alchemy profile: `pnpm exec alchemy profile edit --add Cloudflare` from this directory.
