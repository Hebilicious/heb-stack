import type { Capability, Handles } from "@acid-cat/core-effect";
import { CallFailureError, callFailure, unavailable } from "@acid-cat/spec-ts";
import type { Result } from "@acid-cat/spec-ts";
import {
  checkCapability,
  historyClearCapability,
  historyListCapability,
  nextCapability,
} from "@heb-stack/primes";
import {
  CheckSnapshotSchema,
  primeCheckerLayer,
} from "@heb-stack/primes/runtime";
import type { CheckHistory, PrimeMath } from "@heb-stack/primes/runtime";
import { Layer, Schema } from "effect";

import { app } from "./catalog.ts";
import type { SessionTarget } from "./catalog.ts";
import { openSession } from "./session.ts";
import type { OpenSession, SessionOptions } from "./session.ts";

/** What a host supplies: arithmetic always, and a history when the host keeps one. */
export type AcidCatServices =
  | Layer.Layer<PrimeMath>
  | Layer.Layer<PrimeMath | CheckHistory>;

/** Every service the capabilities need, from the host's own: the domain's owners stay inside the root. */
export function acidCatLayer(services: AcidCatServices) {
  return primeCheckerLayer.pipe(Layer.provideMerge(services));
}

/** A handle whose typed calls answer its capability's own value and failure types. */
export interface CapabilityHandle<Input, Value, Failure> extends Omit<
  Handles.Handle,
  "execute" | "snapshot"
> {
  readonly execute: (
    input: Input,
    options?: Handles.CallOptions
  ) => Promise<Result<Value, Failure>>;
}

type HandleOf<C> =
  C extends Capability.Capability<
    infer Input,
    infer Output,
    infer Failure,
    infer _Services
  >
    ? CapabilityHandle<Input["Type"], Output["Type"], Failure["Type"]>
    : never;

/** A capability outside the session's view: always unavailable, and every call refused as an unknown id. */
function outOfView(capability: Capability.Any, target: string): Handles.Handle {
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

function handleOf<C extends Capability.Any>(
  session: OpenSession,
  capability: C
): HandleOf<C> {
  const handle =
    session.handles.get(capability.id) ?? outOfView(capability, session.target);
  // SAFETY: A handle's `execute` answers exactly what its capability's `run` answers, the types the capability declares;
  // `@acid-cat/core-effect` erases them only because its handles are looked up by id.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the handle belongs to this capability, so its outcome has these types.
  return handle as HandleOf<C>;
}

/** BOUNDARY: The state a session publishes is its JSON form; it is decoded with the schema that owns it. */
function decodedSnapshot(
  source: Handles.Observable<unknown> | undefined
): Handles.Observable<typeof CheckSnapshotSchema.Type> | undefined {
  if (source === undefined) {
    return undefined;
  }
  const decode = Schema.decodeUnknownSync(CheckSnapshotSchema);
  return {
    getSnapshot: () => decode(source.getSnapshot()),
    subscribe: (listener) =>
      source.subscribe((value) => {
        listener(decode(value));
      }),
  };
}

export interface AcidCatOptions extends SessionOptions {
  readonly target: SessionTarget;
}

/**
 * Open the application's one session for a host. Its catalog is a tree that mirrors the ids, with typed calls, and
 * `primes.check` carries the check lifecycle the page renders.
 */
export async function openAcidCat(
  services: AcidCatServices,
  options: AcidCatOptions
) {
  const session = await openSession(app, acidCatLayer(services), options);
  const check = handleOf(session, checkCapability);
  const catalog = {
    primes: {
      check: Object.freeze({
        ...check,
        snapshot: decodedSnapshot(session.handles.get(check.id)?.snapshot),
      }),
      history: {
        clear: handleOf(session, historyClearCapability),
        list: handleOf(session, historyListCapability),
      },
      next: handleOf(session, nextCapability),
    },
  };
  return Object.freeze({ ...session, catalog });
}

export type AcidCat = Awaited<ReturnType<typeof openAcidCat>>;
