/**
 * The conformance fixture of `@acid-cat/cli`, served by this repository's own hosting code so `acid-cat conform` can
 * test it. Each capability shows one behaviour the checks examine; the switch starts on.
 */
import { App, Capability } from "@acid-cat/core-effect";
import { AVAILABLE, unavailable } from "@acid-cat/spec-ts";
import type { Availability } from "@acid-cat/spec-ts";
import { Context, Effect, Layer, Schema, SubscriptionRef } from "effect";

import { Holds, makeHolds } from "./holds.ts";

/** The switch the checks turn on and off: it holds the availability of `fixture.toggle`. */
export class Switch extends Context.Service<
  Switch,
  SubscriptionRef.SubscriptionRef<Availability>
>()("@heb-stack/features/conformance/Switch") {}

/** The availability of `fixture.toggle` while the switch is on or off. */
const position = (on: boolean): Availability =>
  on ? AVAILABLE : unavailable("The switch is off.");

/** A switch of its own, on. */
export const switchLayer = Layer.effect(
  Switch,
  SubscriptionRef.make(position(true))
);

/** The fixture's services: a switch that is on, and holds of their own. */
export const fixtureLayer = (mark?: (path: string) => Effect.Effect<void>) =>
  Layer.merge(switchLayer, Layer.effect(Holds, makeHolds(mark)));

const TextSchema = Schema.Struct({ text: Schema.String });
const KeySchema = Schema.Struct({ key: Schema.String });
const RefusedSchema = Schema.TaggedStruct("Refused", { reason: Schema.String });

const everywhere = ["app", "mcp", "cli", "api"];

/** One property for each kind of command-line flag. */
const FlagsSchema = Schema.Struct({
  count: Schema.optionalKey(Schema.Int),
  extra: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)),
  label: Schema.optionalKey(Schema.String),
  mode: Schema.Literals(["fast", "slow"]),
  ratio: Schema.optionalKey(Schema.Finite),
  verbose: Schema.optionalKey(Schema.Boolean),
});

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
      description:
        "Hold until fixture.release releases the key, then return the key. While the call holds, fixture.held gives the key. With a marker, the call writes a file at that path when it starts to hold.",
      id: "fixture.hold",
      input: Schema.Struct({
        key: Schema.String,
        marker: Schema.optionalKey(Schema.String),
      }),
      output: KeySchema,
      run: ({ key, marker }) =>
        Holds.use((holds) => holds.hold(key, marker)).pipe(Effect.as({ key })),
    }),
    Capability.make({
      audience: everywhere,
      description:
        "Return the keys of the calls to fixture.hold that hold now.",
      id: "fixture.held",
      output: Schema.Struct({ keys: Schema.Array(Schema.String) }),
      readOnly: true,
      run: () =>
        Holds.use((holds) => holds.held).pipe(Effect.map((keys) => ({ keys }))),
    }),
    Capability.make({
      audience: everywhere,
      description: "Release the calls to fixture.hold that hold the key.",
      id: "fixture.release",
      input: KeySchema,
      run: ({ key }) =>
        Holds.use((holds) => holds.release(key)).pipe(Effect.as(null)),
    }),
    Capability.make({
      audience: ["cli"],
      description:
        "Return the input. The input has one property for each kind of command-line flag.",
      id: "fixture.flags",
      input: FlagsSchema,
      output: FlagsSchema,
      run: (input) => Effect.succeed(input),
    }),
    Capability.make({
      audience: ["app"],
      description: "Only the app target can use this capability.",
      id: "fixture.hidden",
      run: () => Effect.succeed(null),
    }),
    Capability.make({
      audience: everywhere,
      availability: Switch,
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
        Switch.use((ref) => SubscriptionRef.set(ref, position(on))).pipe(
          Effect.as(null)
        ),
    }),
  ],
  description: "One capability for each behavior that acid-cat conform tests.",
  targets: {
    api: { bindings: ["http"] },
    app: { bindings: ["typescript", "webmcp"] },
    cli: { bindings: ["cli"] },
    mcp: { bindings: ["mcp"] },
  },
  title: "Fixture",
});
