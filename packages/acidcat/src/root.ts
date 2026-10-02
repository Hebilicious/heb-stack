import {
  checkDefinition,
  historyClearDefinition,
  historyListDefinition,
  nextDefinition,
} from "@heb-stack/application-primes";
import {
  PrimeChecker,
  primeCheckerLayer,
  type CheckHistory,
  type PrimeMath,
} from "@heb-stack/application-primes/runtime";
import { constantSource, type Availability, type SessionTarget } from "@heb-stack/acidcat-kernel";
import type { ModelContextPort } from "@heb-stack/webmcp-adapter";
import { Effect, Exit, Layer, ManagedRuntime, Scope } from "effect";
import { bindCapability, type CapabilitySession } from "./executor.ts";

export interface AcidCatOptions {
  /** The target this session serves; a capability outside its audience never registers. */
  readonly target: SessionTarget;
}

/** What a host supplies: arithmetic always, and a history when the host keeps one. */
export type AcidCatServices = Layer.Layer<PrimeMath> | Layer.Layer<PrimeMath | CheckHistory>;

const available: Availability = Object.freeze({ available: true as const });

/** The only managed application runtime; each host supplies its service Layers and nothing else. */
export async function createAcidCat(options: AcidCatOptions, services: AcidCatServices) {
  const disposal = new AbortController();
  const runtime = ManagedRuntime.make(primeCheckerLayer.pipe(Layer.provideMerge(services)));
  try {
    const checker = await runtime.runPromise(PrimeChecker);
    const session: CapabilitySession = Object.freeze({ signal: disposal.signal, target: options.target });
    const always = constantSource(available);
    const catalog = {
      primes: {
        check: bindCapability(checkDefinition, runtime, { availability: always, snapshot: checker.snapshot }, session),
        next: bindCapability(nextDefinition, runtime, { availability: always }, session),
      },
      history: {
        list: bindCapability(historyListDefinition, runtime, { availability: always }, session),
        clear: bindCapability(historyClearDefinition, runtime, { availability: always }, session),
      },
    };
    const ensureOpen = () => {
      if (disposal.signal.aborted) throw new Error("The AcidCat session is closed");
    };
    return Object.freeze({
      target: options.target,
      catalog,
      // BOUNDARY: The adapter decodes fetched manifest data before registration.
      installWebMcp: async (port: ModelContextPort, loadManifest: (signal: AbortSignal) => Promise<unknown>) => {
        ensureOpen();
        const { installWebMcpAdapter } = await import("@heb-stack/webmcp-adapter");
        ensureOpen();
        const scope = await runtime.runPromise(Scope.make());
        const adapter = await runtime.runPromise(
          Scope.provide(
            installWebMcpAdapter(
              catalog,
              port,
              Effect.tryPromise({
                try: (signal) => loadManifest(signal),
                catch: () => "Tool registration metadata could not be loaded",
              }),
            ),
            scope,
          ),
        );
        return Object.freeze({
          snapshot: adapter.snapshot,
          retry: () => runtime.runPromise(adapter.retry),
          dispose: () => runtime.runPromise(Scope.close(scope, Exit.void)),
        });
      },
      dispose: async () => {
        disposal.abort();
        await runtime.dispose();
      },
    });
  } catch (cause) {
    await runtime.dispose();
    throw cause;
  }
}
export type AcidCat = Awaited<ReturnType<typeof createAcidCat>>;
