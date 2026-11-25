/**
 * The conformance fixture of `@acid-cat/cli`, served by this repository's own hosting code so `acid-cat conform` can
 * test it. Each capability or event shows one behaviour the checks examine; the switch starts on.
 */
import { App, Capability, Event } from "@acid-cat/core-effect";
import { AVAILABLE, unavailable } from "@acid-cat/spec-ts";
import type { Availability } from "@acid-cat/spec-ts";
import {
  Context,
  Effect,
  Layer,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";

import { Holds, makeHolds } from "./holds.ts";
import type { Marker } from "./marker.ts";
import { makeWatchers, Watchers } from "./watchers.ts";

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

/** The fixture's services: a switch that is on, and holds and watchers of their own, which mark with `marker`. */
export const fixtureLayer = (marker?: Marker) =>
  Layer.mergeAll(
    switchLayer,
    Layer.effect(Holds, makeHolds(marker)),
    Layer.effect(Watchers, makeWatchers(marker))
  );

const TextSchema = Schema.Struct({ text: Schema.String });
const KeySchema = Schema.Struct({ key: Schema.String });
const KeysSchema = Schema.Struct({ keys: Schema.Array(Schema.String) });
const RefusedSchema = Schema.TaggedStruct("Refused", { reason: Schema.String });
const TickSchema = Schema.Struct({ n: Schema.Int });
const WatchedSchema = Schema.Struct({
  key: Schema.String,
  value: Schema.String,
});
const AnyObjectSchema = Schema.Record(Schema.String, Schema.Unknown);

const everywhere = ["app", "mcp", "cli", "api"];

/** One property for each kind of command-line flag. */
const FlagsSchema = Schema.Struct({
  count: Schema.optionalKey(Schema.Int),
  extra: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)),
  label: Schema.optionalKey(Schema.String),
  mode: Schema.Literals(["fast", "slow"]),
  ratio: Schema.optionalKey(Schema.Finite),
  steps: Schema.optionalKey(Schema.Array(Schema.Int)),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
  verbose: Schema.optionalKey(Schema.Boolean),
});

const NoteSchema = Schema.Struct({
  loud: Schema.optionalKey(Schema.Boolean),
  text: Schema.String,
}).annotate({ identifier: "Note" });

/** The position after a cursor of `fixture.ticks`: the occurrence after it, or the first. */
const after = (cursor: string | undefined): number => {
  const tick = Number(cursor);
  return Number.isInteger(tick) && tick >= 0 ? tick + 1 : 1;
};

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
        "Hold until fixture.release releases the key, then return the key. While the call holds, fixture.held gives the key. With a marker, the call writes a file at that path when it starts to hold, and deletes the file when it ends.",
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
      output: KeysSchema,
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
      input: Schema.Struct({}),
      run: () => Effect.succeed(null),
    }),
    Capability.make({
      audience: everywhere,
      description:
        "Turn the switch on or off. The switch controls the availability of fixture.toggle.",
      destructive: true,
      id: "fixture.switch.set",
      idempotent: true,
      input: Schema.Struct({
        on: Schema.Boolean.annotate({ "x-mcp-header": "On" }),
      }),
      run: ({ on }) =>
        Switch.use((ref) => SubscriptionRef.set(ref, position(on))).pipe(
          Effect.as(null)
        ),
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
      audience: ["cli"],
      description:
        "Return the input. The input schema is a $ref with a description beside it.",
      id: "fixture.note",
      // Effect writes the description of a schema with an identifier into its type; the description of a suspended
      // schema stays beside the $ref.
      input: Schema.suspend(() => NoteSchema).annotate({
        description: "The note.",
      }),
      output: NoteSchema,
      run: (input) => Effect.succeed(input),
    }),
    Capability.make({
      audience: ["cli"],
      description:
        "Return the input. The input schema has no top-level properties member.",
      id: "fixture.raw",
      input: AnyObjectSchema,
      output: AnyObjectSchema,
      run: (input) => Effect.succeed(input),
    }),
    Capability.make({
      audience: everywhere,
      description:
        "Give an occurrence of fixture.watch to each subscription that watches the key. Return the number of these subscriptions.",
      destructive: false,
      id: "fixture.signal",
      idempotent: false,
      input: WatchedSchema,
      output: Schema.Struct({ delivered: Schema.Int }),
      run: ({ key, value }) =>
        Watchers.use((watchers) => watchers.signal(key, value)).pipe(
          Effect.map((delivered) => ({ delivered }))
        ),
    }),
    Capability.make({
      audience: everywhere,
      description:
        "Return the keys of the subscriptions to fixture.watch that are active now.",
      id: "fixture.watching",
      output: KeysSchema,
      readOnly: true,
      run: () =>
        Watchers.use((watchers) => watchers.watching).pipe(
          Effect.map((keys) => ({ keys }))
        ),
    }),
  ],
  description:
    "One capability or event for each behavior that acid-cat conform tests.",
  events: [
    Event.make({
      audience: everywhere,
      description:
        "Give the occurrences n = 1 to count, with the eventId and the cursor String(n), then end. With a cursor c, start at c + 1. With a gap g, the occurrence n = g has truncated: true, as if the source skipped occurrences before it. The key changes nothing: it gives the subscriptions of each test their own input.",
      id: "fixture.ticks",
      input: Schema.Struct({
        count: Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 0 })),
        gap: Schema.optionalKey(
          Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 1 }))
        ),
        key: Schema.optionalKey(
          Schema.String.annotate({ "x-mcp-header": "Key" })
        ),
      }),
      payload: TickSchema,
      subscribe: ({ count, gap }, { cursor }) =>
        Stream.range(after(cursor), count).pipe(
          Stream.map((n) => {
            const tick = { cursor: String(n), data: { n }, eventId: String(n) };
            return n === gap ? { ...tick, truncated: true as const } : tick;
          })
        ),
    }),
    Event.make({
      audience: everywhere,
      description:
        "Give an occurrence each time that fixture.signal gets the key. Never end. With a marker, write a file at that path when the subscription starts, and delete the file when it ends.",
      id: "fixture.watch",
      input: Schema.Struct({
        key: Schema.String,
        marker: Schema.optionalKey(Schema.String),
      }),
      payload: WatchedSchema,
      subscribe: ({ key, marker }) =>
        Stream.unwrap(
          Watchers.use((watchers) =>
            Effect.succeed(watchers.watch(key, marker))
          )
        ).pipe(Stream.map((value) => ({ data: { key, value } }))),
    }),
    Event.make({
      audience: everywhere,
      description: "Give the occurrence n = 1, then fail with a defect.",
      id: "fixture.broken",
      payload: TickSchema,
      subscribe: () =>
        Stream.concat(
          Stream.make({ data: { n: 1 } }),
          Stream.die("an internal detail no caller may see")
        ),
    }),
    Event.make({
      audience: ["cli"],
      description: "Give one occurrence whose data is the input, then end.",
      id: "fixture.echoes",
      input: AnyObjectSchema,
      payload: AnyObjectSchema,
      subscribe: (input) => Stream.make({ data: input }),
    }),
    Event.make({
      audience: ["app"],
      description:
        "Only the app target can follow this event. It never gives an occurrence.",
      id: "fixture.secret",
      subscribe: () => Stream.never,
    }),
  ],
  targets: {
    api: { surfaces: ["http"] },
    app: { surfaces: ["typescript", "webmcp"] },
    cli: {
      options: {
        cli: {
          aliases: {
            "--hello": { capability: "fixture.echo", input: { text: "hello" } },
            "broken-ticks": { event: "fixture.broken" },
            echoes: { event: "fixture.echoes" },
            "fixed-note": {
              capability: "fixture.note",
              input: { text: "fixed" },
            },
            fixture: { capability: "fixture.flags", input: { mode: "slow" } },
            "held-keys": { capability: "fixture.held" },
            notes: { capability: "fixture.raw" },
            "notes add": { capability: "fixture.note" },
            "notes loud": { capability: "fixture.note", input: { loud: true } },
            quick: { capability: "fixture.flags", input: { mode: "fast" } },
            raw: { capability: "fixture.raw" },
            say: { capability: "fixture.echo" },
            "shout hello": {
              capability: "fixture.echo",
              input: { text: "HELLO" },
            },
            ticks: { event: "fixture.ticks", input: { count: 2 } },
          },
          default: "quick",
        },
      },
      surfaces: ["cli"],
    },
    mcp: { surfaces: ["mcp"] },
  },
  title: "Fixture",
});
