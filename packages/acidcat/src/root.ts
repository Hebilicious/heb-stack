import { Handles } from "@acid-cat/core-effect";
import {
  checkCapability,
  historyClearCapability,
  historyListCapability,
  nextCapability,
} from "@heb-stack/primes";
import { primeCheckerLayer } from "@heb-stack/primes/runtime";
import type { CheckHistory, PrimeMath } from "@heb-stack/primes/runtime";
import { Layer } from "effect";

import { app } from "./catalog.ts";
import type { SessionTarget } from "./catalog.ts";

/** What a host supplies: arithmetic always, and a history when the host keeps one. */
export type AcidCatServices =
  | Layer.Layer<PrimeMath>
  | Layer.Layer<PrimeMath | CheckHistory>;

/** Every service the capabilities need, from the host's own: the domain's owners stay inside the root. */
export function acidCatLayer(services: AcidCatServices) {
  return primeCheckerLayer.pipe(Layer.provideMerge(services));
}

export interface AcidCatOptions extends Handles.OpenOptions {
  readonly target: SessionTarget;
}

/**
 * Open the application's one session for a host. Its services, handles and, given a host, WebMCP tools close together
 * with `dispose`. Its catalog is a tree that mirrors the ids, with typed calls, and `primes.check` carries the check
 * lifecycle the page renders.
 */
export async function openAcidCat(
  services: AcidCatServices,
  options: AcidCatOptions
) {
  const session = await Handles.open(app, acidCatLayer(services), options);
  const catalog = {
    primes: {
      check: session.handle(checkCapability),
      history: {
        clear: session.handle(historyClearCapability),
        list: session.handle(historyListCapability),
      },
      next: session.handle(nextCapability),
    },
  };
  const dispose = async () => {
    await session.dispose();
  };
  return Object.freeze({
    catalog,
    dispose,
    /** The handles by id, without their types, for bindings such as the capnweb API. */
    handles: session.handles,
    [Symbol.asyncDispose]: dispose,
    target: session.target,
    webmcp: session.webmcp,
  });
}

export type AcidCat = Awaited<ReturnType<typeof openAcidCat>>;
