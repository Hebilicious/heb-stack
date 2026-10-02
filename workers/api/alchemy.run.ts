import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { Api } from "./src/contract.ts";
import ApiLive from "./src/worker.ts";

/**
 * Where the stack keeps its state. Development and tests keep it on disk in `.alchemy/`, so they need no Cloudflare
 * account; a deploy sets `HEB_STACK_STATE=cloudflare` and shares the account's Alchemy state store, so every machine
 * sees the same deployment.
 */
const state =
  process.env.HEB_STACK_STATE === "cloudflare"
    ? Cloudflare.state()
    : Alchemy.localState();

export default Alchemy.Stack(
  "heb-stack",
  { providers: Cloudflare.providers(), state },
  Effect.gen(function* () {
    const api = yield* Api;
    return { url: api.url };
  }).pipe(Effect.provide(ApiLive))
);
