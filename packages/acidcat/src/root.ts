import { constantSource } from "@heb-stack/acidcat-kernel";
import type { Availability, SessionTarget } from "@heb-stack/acidcat-kernel";
import {
  checkDefinition,
  historyClearDefinition,
  historyListDefinition,
  nextDefinition,
} from "@heb-stack/application-primes";
import {
  PrimeChecker,
  primeCheckerLayer,
} from "@heb-stack/application-primes/runtime";
import type {
  CheckHistory,
  PrimeMath,
} from "@heb-stack/application-primes/runtime";
import type { ModelContextPort } from "@heb-stack/webmcp-adapter";
import { Effect, Exit, Layer, ManagedRuntime, Scope } from "effect";

import { bindCapability } from "./executor.ts";
import type { CapabilitySession } from "./executor.ts";

export interface AcidCatOptions {
  /** The target this session serves; a capability outside its audience never registers. */
  readonly target: SessionTarget;
}

/** What a host supplies: arithmetic always, and a history when the host keeps one. */
export type AcidCatServices =
  | Layer.Layer<PrimeMath>
  | Layer.Layer<PrimeMath | CheckHistory>;

const available: Availability = Object.freeze({ available: true as const });

/** The only managed application runtime; each host supplies its service Layers and nothing else. */
export async function createAcidCat(
  options: AcidCatOptions,
  services: AcidCatServices
) {
  const disposal = new AbortController();
  const runtime = ManagedRuntime.make(
    primeCheckerLayer.pipe(Layer.provideMerge(services))
  );
  try {
    const checker = await runtime.runPromise(PrimeChecker);
    const session: CapabilitySession = Object.freeze({
      signal: disposal.signal,
      target: options.target,
    });
    const always = constantSource(available);
    const catalog = {
      history: {
        clear: bindCapability(
          historyClearDefinition,
          runtime,
          { availability: always },
          session
        ),
        list: bindCapability(
          historyListDefinition,
          runtime,
          { availability: always },
          session
        ),
      },
      primes: {
        check: bindCapability(
          checkDefinition,
          runtime,
          { availability: always, snapshot: checker.snapshot },
          session
        ),
        next: bindCapability(
          nextDefinition,
          runtime,
          { availability: always },
          session
        ),
      },
    };
    const ensureOpen = () => {
      if (disposal.signal.aborted) {
        throw new Error("The AcidCat session is closed");
      }
    };
    return Object.freeze({
      catalog,
      dispose: async () => {
        disposal.abort();
        await runtime.dispose();
      },
      // BOUNDARY: The adapter decodes fetched manifest data before registration.
      installWebMcp: async (
        port: ModelContextPort,
        loadManifest: (signal: AbortSignal) => Promise<unknown>
      ) => {
        ensureOpen();
        const { installWebMcpAdapter } =
          await import("@heb-stack/webmcp-adapter");
        ensureOpen();
        const scope = await runtime.runPromise(Scope.make());
        const adapter = await runtime.runPromise(
          Scope.provide(
            installWebMcpAdapter(
              catalog,
              port,
              Effect.tryPromise({
                catch: () => "Tool registration metadata could not be loaded",
                try: async (signal) => await loadManifest(signal),
              })
            ),
            scope
          )
        );
        return Object.freeze({
          dispose: async () => {
            await runtime.runPromise(Scope.close(scope, Exit.void));
          },
          retry: async () => {
            await runtime.runPromise(adapter.retry);
          },
          snapshot: adapter.snapshot,
        });
      },
      target: options.target,
    });
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
export type AcidCat = Awaited<ReturnType<typeof createAcidCat>>;
