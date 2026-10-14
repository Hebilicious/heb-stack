/**
 * The conformance fixture of `@acid-cat/cli`, served by this repository's own hosting code so `acid-cat conform` can
 * test it. Each capability shows one behaviour the checks examine; the switch starts on.
 */
import { App, Capability } from "@acid-cat/core-effect";
import { AVAILABLE, unavailable } from "@acid-cat/spec-ts";
import {
  Context,
  Effect,
  Layer,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";

/** The switch the checks turn on and off, which decides whether `fixture.toggle` is available. */
export class Switch extends Context.Service<
  Switch,
  SubscriptionRef.SubscriptionRef<boolean>
>()("@heb-stack/features/conformance/Switch") {}

/** A switch of its own, on. */
export const switchLayer = Layer.effect(Switch, SubscriptionRef.make(true));

const TextSchema = Schema.Struct({ text: Schema.String });
const RefusedSchema = Schema.TaggedStruct("Refused", { reason: Schema.String });

const everywhere = ["app", "mcp", "cli", "api"];

export const fixture = App.make({
  capabilities: [
    Capability.make({
      audience: everywhere,
      description: "Return the input text.",
      id: "fixture.echo",
      input: TextSchema,
      output: TextSchema,
      readOnly: true,
      run: (input) => Effect.succeed(input),
    }),
    Capability.make({
      audience: everywhere,
      description: "Always return the failure Refused.",
      failures: [RefusedSchema],
      id: "fixture.refuse",
      run: () => Effect.fail(RefusedSchema.make({ reason: "No." })),
    }),
    Capability.make({
      audience: everywhere,
      description: "Always fail with a defect.",
      id: "fixture.crash",
      run: () => Effect.die("an internal detail no caller may see"),
    }),
    Capability.make({
      audience: everywhere,
      description: "Wait for some milliseconds, then return null.",
      id: "fixture.slow",
      input: Schema.Struct({ milliseconds: Schema.Finite }),
      // The checks cancel this call; the wait is the behaviour under test, not a pace.
      run: ({ milliseconds }) =>
        Effect.sleep(milliseconds).pipe(Effect.as(null)),
    }),
    Capability.make({
      audience: ["app"],
      description: "Only the app target can use this capability.",
      id: "fixture.hidden",
      run: () => Effect.succeed(null),
    }),
    Capability.make({
      audience: everywhere,
      availability: Stream.unwrap(
        Switch.use((on) =>
          Effect.succeed(
            SubscriptionRef.changes(on).pipe(
              Stream.map((value) =>
                value ? AVAILABLE : unavailable("The switch is off.")
              )
            )
          )
        )
      ),
      description: "Available only while the switch is on.",
      id: "fixture.toggle",
      run: () => Effect.succeed(null),
    }),
    Capability.make({
      audience: everywhere,
      description:
        "Turn the switch on or off. The switch controls the availability of fixture.toggle.",
      id: "fixture.switch.set",
      input: Schema.Struct({ on: Schema.Boolean }),
      run: ({ on }) =>
        Switch.use((ref) => SubscriptionRef.set(ref, on)).pipe(Effect.as(null)),
    }),
  ],
  targets: {
    api: { bindings: ["http"] },
    app: { bindings: ["typescript", "webmcp"] },
    cli: { bindings: ["cli"] },
    mcp: { bindings: ["mcp"] },
  },
  title: "Fixture",
});
