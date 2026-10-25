import { Handles, Session, WebMcp } from "@acid-cat/core-effect";
import type { App, Capability } from "@acid-cat/core-effect";
import {
  CallFailureError,
  callFailure,
  isCallFailure,
  unavailable,
} from "@acid-cat/spec-ts";
import type { Outcome, Result } from "@acid-cat/spec-ts";
import {
  Cause,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";

export interface SessionOptions {
  /** The target this session serves; a capability outside its audience has no handle and registers no tool. */
  readonly target: string;
  /** The WebMCP host the view's tools register on. Without one, the session registers no tool and loads nothing for it. */
  readonly webmcp?: WebMcp.ModelContext | undefined;
}

/** The view's tools on a WebMCP host, while the session is open. */
export interface WebMcpRegistration {
  readonly status: Handles.Observable<WebMcp.Status>;
  /** Try the last failed registration again. */
  readonly retry: () => Promise<void>;
}

/** An open session: its handles, its WebMCP registration, and the one call that closes it. */
export interface OpenSession<Services = never> {
  readonly target: string;
  /** The handles of the view by id, without the types of their schemas, for bindings. */
  readonly handles: ReadonlyMap<string, Handles.Handle>;
  /**
   * The handle of a capability, with the types of its schemas and its state decoded. Only the capability object the session serves is called; any other,
   * also one with the same id, is always unavailable and refused as an unknown capability.
   */
  readonly handle: <
    Input extends Capability.AnySchema,
    Output extends Capability.AnySchema,
    Failure extends Capability.AnySchema,
    State extends Capability.AnySchema,
    Id extends string,
  >(
    capability: Capability.Capability<
      Input,
      Output,
      Failure,
      Services,
      State,
      Id
    >
  ) => Handles.Handle<
    Input["Type"],
    Output["Type"],
    Failure["Type"],
    State["Type"]
  >;
  readonly webmcp: WebMcpRegistration | null;
  /** Close the session: unregister its tools, cancel the calls in flight and release its services. */
  readonly dispose: () => Promise<void>;
}

const cancelled = () =>
  new CallFailureError(callFailure("cancelled", "The call was cancelled."));

/**
 * Run a typed call as a promise. The session's lifetime and the call's own signal interrupt it, and it rejects as
 * `cancelled`; a call failure rejects with its `CallFailureError`.
 */
function caller(lifetime: AbortSignal) {
  return async <Value, Failure>(
    outcome: Effect.Effect<Outcome<Value, Failure>>,
    options?: Handles.CallOptions
  ): Promise<Result<Value, Failure>> => {
    const signal = AbortSignal.any(
      options?.signal === undefined ? [lifetime] : [lifetime, options.signal]
    );
    if (signal.aborted) {
      throw cancelled();
    }
    const exit = await Effect.runPromiseExit(outcome, { signal });
    if (Exit.isFailure(exit)) {
      throw Cause.hasInterruptsOnly(exit.cause)
        ? cancelled()
        : Cause.squash(exit.cause);
    }
    if (isCallFailure(exit.value)) {
      throw new CallFailureError(exit.value);
    }
    return exit.value;
  };
}

/** A capability outside the session's view: always unavailable, and every call refused as an unknown id. */
function outOfView(
  capability: Capability.Any,
  target: string
): Handles.Handle<never, never, never, never> {
  const failure = callFailure(
    "unknown-capability",
    `${capability.id} is not served to the ${target} target.`
  );
  const availability = unavailable(failure.message);
  const refuse = async () =>
    await Promise.reject(new CallFailureError(failure));
  return {
    audience: capability.audience,
    availability: {
      getSnapshot: () => availability,
      subscribe: () => ({
        unsubscribe: () => {
          // The availability never changes, so there is nothing to release.
        },
      }),
    },
    description: capability.description,
    execute: refuse,
    id: capability.id,
    invokeExternal: refuse,
  };
}

/** BOUNDARY: A handle publishes its state in its JSON form; it is decoded with the schema that owns it. */
function decodedSnapshot<State extends Capability.AnySchema>(
  source: Handles.Observable<unknown>,
  schema: State
): Handles.Observable<State["Type"]> {
  const decode = Schema.decodeUnknownSync(schema);
  return {
    getSnapshot: () => decode(source.getSnapshot()),
    subscribe: (listener) =>
      source.subscribe((value) => {
        listener(decode(value));
      }),
  };
}

/** A subscription ref as an observable for code without Effect, following it until the scope closes. */
const observe = Effect.fnUntraced(function* <Value>(
  ref: SubscriptionRef.SubscriptionRef<Value>
) {
  let current = yield* SubscriptionRef.get(ref);
  const listeners = new Set<(value: Value) => void>();
  yield* SubscriptionRef.changes(ref).pipe(
    Stream.runForEach((value) =>
      Effect.sync(() => {
        current = value;
        for (const listener of listeners) {
          listener(value);
        }
      })
    ),
    Effect.forkScoped({ startImmediately: true })
  );
  const observable: Handles.Observable<Value> = {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return {
        unsubscribe: () => {
          listeners.delete(listener);
        },
      };
    },
  };
  return observable;
});

/**
 * Open a session of `app` for code without Effect: its services, its handles and, given a host, its WebMCP tools all
 * belong to one scope, so `dispose` releases them together.
 */
export async function openSession<Services, Failure>(
  app: App.App<Services>,
  services: Layer.Layer<Services, Failure>,
  options: SessionOptions
): Promise<OpenSession<Services>> {
  const scope = Effect.runSync(Scope.make());
  const lifetime = new AbortController();
  const dispose = async () => {
    lifetime.abort();
    await Effect.runPromise(Scope.close(scope, Exit.void));
  };
  try {
    const opened = await Effect.runPromise(
      Effect.gen(function* () {
        const context = yield* Layer.buildWithScope(services, scope);
        const session = yield* Session.make(app, {
          target: options.target,
        }).pipe(Effect.provideContext(context));
        const handles = yield* Handles.make(app, session);
        const installation =
          options.webmcp === undefined
            ? Option.none<WebMcp.Installation>()
            : yield* WebMcp.install(session, { host: options.webmcp });
        const run = Effect.runPromiseWith(yield* Effect.context());
        const webmcp = yield* Option.match(installation, {
          onNone: () => Effect.succeed(null),
          onSome: ({ retry, status }) =>
            observe(status).pipe(
              Effect.map((observed): WebMcpRegistration => ({
                retry: async () => {
                  await run(retry);
                },
                status: observed,
              }))
            ),
        });
        const call = caller(lifetime.signal);
        const handle: OpenSession<Services>["handle"] = (capability) => {
          const untyped = handles.get(capability.id);
          if (untyped === undefined) {
            return outOfView(capability, options.target);
          }
          const typed: ReturnType<OpenSession<Services>["handle"]> = {
            audience: untyped.audience,
            availability: untyped.availability,
            description: untyped.description,
            execute: async (input, callOptions) =>
              await call(session.outcome(capability, input), callOptions),
            id: untyped.id,
            invokeExternal: async (input, callOptions) =>
              await untyped.invokeExternal(input, callOptions),
          };
          const { snapshot } = untyped;
          const { state } = capability;
          if (snapshot === undefined || state === undefined) {
            return typed;
          }
          return {
            ...typed,
            snapshot: decodedSnapshot(snapshot, state.schema),
          };
        };
        return { handle, handles, webmcp };
      }).pipe(Scope.provide(scope))
    );
    return Object.freeze({ ...opened, dispose, target: options.target });
  } catch (error) {
    await dispose();
    throw error;
  }
}
