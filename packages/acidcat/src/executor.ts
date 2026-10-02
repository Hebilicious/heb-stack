import { Cause, Effect, Exit, Option, Schema, type ManagedRuntime } from "effect";
import {
  capabilityTypeId,
  detachedSource,
  servesTarget,
  unavailableSource,
  type AvailabilitySource,
  type CapabilityDefinition,
  type CapabilityHandle,
  type ExecuteOptions,
  type ReadonlySnapshotSource,
  type Result,
  type SessionTarget,
} from "@heb-stack/acidcat-kernel";

/**
 * The session a capability is bound into: the facts every capability in it shares, so a binder states the session
 * rather than threading a signal and a target through every call.
 */
export interface CapabilitySession {
  /** The signal that cancels every invocation this session starts. */
  readonly signal: AbortSignal;
  /** The target this session serves, so a capability outside its audience never registers. */
  readonly target: SessionTarget;
}

export function bindCapability<Id extends string, Input, Output, Failure, Requirements, Snapshot>(
  definition: CapabilityDefinition<Id, Input, Output, Failure, Requirements>,
  runtime: ManagedRuntime.ManagedRuntime<Requirements, never>,
  binding: {
    readonly availability: AvailabilitySource;
    readonly snapshot?: ReadonlySnapshotSource<Snapshot>;
  },
  session: CapabilitySession,
): CapabilityHandle<Id, Input, Output, Failure, Snapshot> {
  // A capability reaches a target only when its own definition names that target, so a tool surface grows one
  // deliberate declaration at a time and nothing outside it can be listed or invoked.
  const availability = servesTarget(definition.audience, session.target)
    ? binding.availability
    : unavailableSource(`${definition.id} is not served by the ${session.target} target`);
  // BOUNDARY: Decode unknown invocation input using its canonical capability program schema.
  function invoke(input: unknown, options?: ExecuteOptions): Promise<Result<Output, Failure>>;
  // BOUNDARY: External calls use the same canonical input decoder as typed calls.
  function invoke(
    input: unknown,
    options: ExecuteOptions | undefined,
    encoded: true,
  ): Promise<Result<unknown, unknown>>;
  // BOUNDARY: Decode caller input before running the program.
  async function invoke(
    input: unknown,
    options: ExecuteOptions = {},
    encoded = false,
  ): Promise<Result<unknown, unknown>> {
    const signal = options.signal === undefined ? session.signal : AbortSignal.any([session.signal, options.signal]);
    if (signal.aborted) throw cancellationError();
    assertAvailable(availability);
    const computation = Effect.gen(function* () {
      const program = yield* definition.load;
      const decoded = yield* Schema.decodeUnknownEffect(program.input)(input).pipe(
        Effect.mapError(() => InvocationInputFailure.make({ message: `Invalid input for ${definition.id}` })),
      );
      return yield* program.run(decoded).pipe(
        Effect.matchEffect({
          onSuccess: (value) =>
            projectResult(program.output, value, encoded).pipe(Effect.map((value) => ({ ok: true, value }) as const)),
          onFailure: (error) =>
            projectResult(program.error, error, encoded).pipe(Effect.map((error) => ({ ok: false, error }) as const)),
        }),
      );
    }).pipe(
      Effect.scoped,
      Effect.tapCause((cause) => (Cause.hasDies(cause) ? Effect.logError(Cause.pretty(cause)) : Effect.void)),
    );
    const exit = await runtime.runPromiseExit(computation, { signal });
    if (signal.aborted) throw cancellationError();
    if (Exit.isSuccess(exit)) return exit.value;
    if (Cause.hasInterrupts(exit.cause)) throw cancellationError();
    const boundaryFailure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(boundaryFailure) && Schema.is(InvocationInputFailure)(boundaryFailure.value))
      throw new TypeError(boundaryFailure.value.message);
    throw new Error(`Capability ${definition.id} failed to execute`);
  }
  const handle = {
    [capabilityTypeId]: true as const,
    id: definition.id,
    description: definition.description,
    audience: definition.audience,
    availability,
    execute: (input: Input, options?: ExecuteOptions) => invoke(input, options),
    // BOUNDARY: Delegate external input to the canonical schema decoder above.
    invokeExternal: (input: unknown, options?: ExecuteOptions) => invoke(input, options, true),
  };
  return binding.snapshot === undefined
    ? Object.freeze(handle)
    : Object.freeze({ ...handle, snapshot: detachedSource(binding.snapshot) });
}

/** Rejected input, thrown to the external caller as a `TypeError`. */
const InvocationInputFailure = Schema.TaggedStruct("InvocationInputFailure", { message: Schema.String });

function assertAvailable(source: AvailabilitySource): void {
  const availability = source.getSnapshot();
  if (!availability.available) throw new Error(availability.reason);
}

function cancellationError(): Error {
  const error = new Error("The capability invocation was cancelled");
  error.name = "AbortError";
  return error;
}

/** Trusted results need isolation; only external adapters need the canonical wire transformation. */
function projectResult<Value>(schema: Schema.Codec<Value, unknown>, value: Value, encoded: boolean) {
  if (encoded)
    return Schema.encodeEffect(schema, { disableChecks: true })(value).pipe(
      Effect.map((value) => structuredClone(value)),
      Effect.orDie,
    );
  return Effect.sync(() => structuredClone(value));
}
