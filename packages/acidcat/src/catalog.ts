import { App } from "@acid-cat/core-effect";
import { primeCapabilities } from "@heb-stack/primes";

/**
 * What each session is for, with the bindings that serve it. `web` is the page: Vue and the WebMCP tools that drive
 * it. `cli`, `mcp` and `rpc` are tool surfaces, and `hs:capnweb` is this application's own capnweb API. A capability
 * reaches a target only when its audience names it.
 */
const targets = {
  cli: { bindings: ["cli"] },
  mcp: { bindings: ["mcp"] },
  rpc: { bindings: ["hs:capnweb"] },
  web: { bindings: ["typescript", "webmcp"] },
} as const satisfies Record<string, App.Target>;

export type SessionTarget = keyof typeof targets;

/** The application: one namespace, `primes`, whose ids all begin with it. Importing it acquires no service. */
export const app = App.make({
  capabilities: [...primeCapabilities],
  description:
    "A prime checker: check a number, find the next prime, and keep a history of checks.",
  targets,
  title: "heb-stack",
});

/** Every capability id the application declares. */
export const capabilityIds: ReadonlySet<string> = new Set(
  app.capabilities.map((capability) => capability.id)
);
