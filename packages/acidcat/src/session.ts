import { Handles, Session, WebMcp } from "@acid-cat/core-effect";
import type { App } from "@acid-cat/core-effect";
import {
  Effect,
  Exit,
  Layer,
  Option,
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

/** An open session: its handles by id, its WebMCP registration, and the one call that closes it. */
export interface OpenSession {
  readonly target: string;
  readonly handles: ReadonlyMap<string, Handles.Handle>;
  readonly webmcp: WebMcpRegistration | null;
  /** Close the session: unregister its tools, cancel the calls in flight and release its services. */
  readonly dispose: () => Promise<void>;
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
): Promise<OpenSession> {
  const scope = Effect.runSync(Scope.make());
  const dispose = async () => {
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
        return { handles, webmcp };
      }).pipe(Scope.provide(scope))
    );
    return Object.freeze({ ...opened, dispose, target: options.target });
  } catch (error) {
    await dispose();
    throw error;
  }
}
