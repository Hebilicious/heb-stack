import { walkCapabilities } from "@heb-stack/acidcat-kernel";
import type {
  Catalog,
  ReadonlySnapshotSource,
} from "@heb-stack/acidcat-kernel";
import {
  createEffectActor,
  fromEffect,
  setupEffect,
  send,
  waitFor,
} from "@xstate/effect";
import { Effect, Fiber, Schema } from "effect";
import { standardSchemaValidator } from "xstate/validation";

import { ManifestSchema } from "./manifest.ts";
import type { ManifestEntrySchema } from "./manifest.ts";

/** BOUNDARY: The browser supplies unknown input; the root validates it and encodes each canonical result. */
export interface ModelContextTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly execute: (
    input: unknown,
    options?: { readonly signal?: AbortSignal }
  ) => Promise<unknown>;
}
export interface ModelContextPort {
  readonly registerTool: (
    tool: ModelContextTool,
    options: { readonly signal: AbortSignal }
  ) => Promise<void>;
}
export interface WebMcpStatus {
  readonly phase:
    | "loading"
    | "reconciling"
    | "ready"
    | "failed"
    | "closing"
    | "disposed";
  readonly message: string | null;
}

/** Drop a tool call from the set disposal waits on once it settles; its caller observes how it settled. */
async function forgetWhenSettled(
  work: Promise<unknown>,
  calls: Set<Promise<unknown>>
): Promise<void> {
  try {
    await work;
  } catch {
    // The caller holds the same promise and observes the failure itself.
  } finally {
    calls.delete(work);
  }
}

/** Generic registration lifecycle. No capability ID or domain behavior appears here. */
export const installWebMcpAdapter = Effect.fn("WebMCP.install")(function* (
  catalog: Catalog,
  port: ModelContextPort,
  loadManifest: Effect.Effect<unknown, string>
) {
  const leaves = walkCapabilities(catalog);
  const entries = new Map<string, typeof ManifestEntrySchema.Type>();
  const ownerScope = yield* Effect.scope;
  const pendingLoads = new Set<Fiber.Fiber<void, string>>();
  const loadProgram = loadManifest.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(ManifestSchema)),
    Effect.flatMap((manifest) => {
      const ids = new Set(manifest.capabilities.map((entry) => entry.id));
      if (
        ids.size !== manifest.capabilities.length ||
        ids.size !== leaves.length ||
        leaves.some((leaf) => !ids.has(leaf.id))
      ) {
        return Effect.fail(
          "The generated manifest does not match the capability catalog"
        );
      }
      return Effect.sync(() => {
        for (const entry of manifest.capabilities) {
          entries.set(entry.id, entry);
        }
      });
    }),
    Effect.mapError(
      () =>
        "Tool registration metadata could not be loaded. Retry registration."
    )
  );
  const load = fromEffect({
    effect: () =>
      Effect.acquireUseRelease(
        Effect.forkIn(loadProgram, ownerScope, { startImmediately: true }),
        (fiber) =>
          Effect.sync(() => pendingLoads.add(fiber)).pipe(
            Effect.andThen(Fiber.join(fiber))
          ),
        (fiber) =>
          Fiber.interrupt(fiber).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                pendingLoads.delete(fiber);
              })
            )
          )
      ),
  });
  const lifetime = new AbortController();
  const committed = new Map<string, AbortController>();
  const pendingRegistrations = new Set<Promise<void>>();
  const calls = new Set<Promise<unknown>>();

  const reconcile = fromEffect({
    effect: () =>
      Effect.tryPromise({
        catch: () => "Tool registration failed. Retry registration.",
        try: async (signal) => {
          const added = new Map<string, AbortController>();
          try {
            for (const leaf of leaves) {
              if (signal.aborted || lifetime.signal.aborted) {
                throw signal.reason ?? lifetime.signal.reason;
              }
              if (
                !leaf.availability.getSnapshot().available ||
                committed.has(leaf.id)
              ) {
                continue;
              }
              const entry = entries.get(leaf.id);
              if (entry === undefined) {
                throw new Error("A canonical manifest entry is missing");
              }
              const registration = new AbortController();
              added.set(leaf.id, registration);
              const registrationSignal = AbortSignal.any([
                registration.signal,
                lifetime.signal,
              ]);
              const registrationWork = port.registerTool(
                {
                  description: leaf.description,
                  execute: async (input, options) => {
                    if (registrationSignal.aborted) {
                      throw registrationSignal.reason;
                    }
                    const executionSignal =
                      options?.signal === undefined
                        ? lifetime.signal
                        : AbortSignal.any([lifetime.signal, options.signal]);
                    const work = leaf.invokeExternal(input, {
                      signal: executionSignal,
                    });
                    calls.add(work);
                    void forgetWhenSettled(work, calls);
                    return await work;
                  },
                  inputSchema: entry.inputSchema,
                  name: leaf.id,
                },
                { signal: registrationSignal }
              );
              pendingRegistrations.add(registrationWork);
              try {
                // oxlint-disable-next-line no-await-in-loop -- registrations commit in catalog order, and one that fails stops the rest.
                await registrationWork;
              } finally {
                pendingRegistrations.delete(registrationWork);
              }
            }
            if (signal.aborted || lifetime.signal.aborted) {
              throw signal.reason ?? lifetime.signal.reason;
            }
            for (const [id, controller] of added) {
              committed.set(id, controller);
            }
            for (const leaf of leaves) {
              if (leaf.availability.getSnapshot().available) {
                continue;
              }
              committed.get(leaf.id)?.abort();
              committed.delete(leaf.id);
            }
          } catch (error) {
            for (const controller of added.values()) {
              controller.abort();
            }
            throw error;
          }
        },
      }),
  });
  const close = fromEffect({
    effect: () =>
      Effect.gen(function* () {
        lifetime.abort();
        yield* Effect.forEach([...pendingLoads], Fiber.interrupt);
        yield* Effect.promise(async () => {
          for (const controller of committed.values()) {
            controller.abort();
          }
          committed.clear();
          await Promise.allSettled([...pendingRegistrations, ...calls]);
        });
      }),
  });
  const machine = setupEffect({
    actors: { close, load, reconcile },
    schemas: {
      context: Schema.Struct({
        dirty: Schema.Boolean,
        message: Schema.NullOr(Schema.String),
      }),
      events: {
        CHANGED: Schema.Struct({}),
        DISPOSE: Schema.Struct({}),
        RETRY: Schema.Struct({}),
      },
    },
    validator: standardSchemaValidator(),
  }).createMachine({
    context: { dirty: false, message: null },
    id: "webmcpRegistration",
    initial: "loading",
    on: { DISPOSE: { target: ".closing" } },
    states: {
      closing: { invoke: { onDone: { target: "disposed" }, src: "close" } },
      disposed: { type: "final" },
      failed: {
        on: { RETRY: { context: { message: null }, target: "reconciling" } },
      },
      loadFailed: {
        on: { RETRY: { context: { message: null }, target: "loading" } },
      },
      loading: {
        invoke: {
          onDone: { target: "reconciling" },
          onError: ({ event }) => ({
            context: { message: event.error },
            target: "loadFailed",
          }),
          src: "load",
        },
      },
      ready: { on: { CHANGED: { target: "reconciling" } } },
      reconciling: {
        // Availability that changes mid-pass marks the pass dirty, and a dirty pass reconciles again when it ends.
        invoke: {
          onDone: ({ context }) =>
            context.dirty
              ? {
                  context: { dirty: false },
                  reenter: true,
                  target: "reconciling",
                }
              : { target: "ready" },
          onError: ({ event }) => ({
            context: { message: event.error },
            target: "failed",
          }),
          src: "reconcile",
        },
        on: { CHANGED: { context: { dirty: true } } },
      },
    },
  });
  const actor = yield* createEffectActor(machine);
  const subscriptions = leaves.map((leaf) =>
    leaf.availability.subscribe(() => {
      actor.send({ type: "CHANGED" });
    })
  );
  const dispose = Effect.gen(function* () {
    lifetime.abort();
    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
    if (actor.getSnapshot().status === "done") {
      return;
    }
    yield* send(actor, { type: "DISPOSE" });
    yield* waitFor(actor, (snapshot) => snapshot.status === "done").pipe(
      Effect.catchTag("ActorStoppedError", () => Effect.void)
    );
  });
  yield* Effect.addFinalizer(() => dispose);
  const phases = [
    "loading",
    "reconciling",
    "ready",
    "failed",
    "closing",
  ] as const;
  const project = (): WebMcpStatus => {
    const snapshot = actor.getSnapshot();
    const phase = snapshot.matches("loadFailed")
      ? "failed"
      : (phases.find((candidate) => snapshot.matches(candidate)) ?? "disposed");
    return { message: snapshot.context.message, phase };
  };
  const snapshot: ReadonlySnapshotSource<WebMcpStatus> = {
    getSnapshot: project,
    subscribe: (listener) =>
      actor.subscribe(() => {
        listener(project());
      }),
  };
  return { dispose, retry: send(actor, { type: "RETRY" }), snapshot };
});
