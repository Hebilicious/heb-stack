import { servesTarget, walkDefinitions } from "@heb-stack/acidcat-kernel";
import type { DescribableCapability } from "@heb-stack/acidcat-kernel";
import { definitions } from "@heb-stack/acidcat/catalog";
import { Effect, Option, Predicate, Schema } from "effect";
import { Command, Flag } from "effect/cli";
import type { CliError } from "effect/cli";

import { sessionFlags, sessionFlagsOf } from "./session.ts";
import type { SessionFlags } from "./session.ts";

/** One property of a leaf's input, as the JSON Schema it publishes describes it. */
const PropertySchema = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  enum: Schema.optionalKey(Schema.Array(Schema.String)),
  type: Schema.optionalKey(Schema.String),
});
type Property = typeof PropertySchema.Type;

/** A leaf's input JSON Schema: an object of named properties. */
const InputJsonSchema = Schema.Struct({
  properties: Schema.optionalKey(Schema.Record(Schema.String, PropertySchema)),
  required: Schema.optionalKey(Schema.Array(Schema.String)),
});

/** One JSON value: what a flag contributes to an input, before the leaf's own schema decodes it. */
type Json = typeof Schema.Json.Type;

/** The input a derived command passes to its leaf: one JSON value per property the flags named. */
const CapabilityInputSchema = Schema.Record(Schema.String, Schema.Json);
export type CapabilityInput = typeof CapabilityInputSchema.Type;

/** How a derived command hands a call to the session: where the session lives, the leaf's id, and its input. */
export type InvokeCapability = (
  flags: SessionFlags,
  id: string,
  input: CapabilityInput
) => Effect.Effect<void, CliError.UserError>;

/** No input: what a namespace command, which only holds subcommands, parses. */
type NoInput = Record<never, never>;

/** A namespace command, such as `primes`: it only nests the commands beneath it. */
type NamespaceCommand = Command.Command<
  string,
  NoInput,
  NoInput,
  CliError.UserError
>;

/** A command the derivation builds: a leaf that parses its flags, or a namespace that nests leaves. */
export type CapabilityCommand = LeafCommand | NamespaceCommand;
type LeafCommand = ReturnType<typeof leafCommand>["command"];

/** One leaf the command line serves, with the flags its input becomes. */
export interface DerivedCommand {
  readonly id: string;
  readonly description: string;
  /** The words after the binary's name, such as `primes check`. */
  readonly path: readonly string[];
  readonly flags: readonly { readonly name: string; readonly hint: string }[];
}

/**
 * The flag one input property becomes: integers, numbers, booleans and string choices parse as such, and anything
 * structured is passed as JSON. The leaf's own schema still decodes the input, so a flag only shapes the call.
 */
function flagFor(name: string, property: Property, required: boolean) {
  const base = ((): Flag.Flag<Json> => {
    if (property.enum !== undefined) {
      return Flag.Literals(name, property.enum);
    }
    if (property.type === "integer") {
      return Flag.Int(name);
    }
    if (property.type === "number") {
      return Flag.Finite(name);
    }
    if (property.type === "boolean") {
      return Flag.Boolean(name);
    }
    if (property.type === "string") {
      return Flag.String(name);
    }
    return Flag.String(name).pipe(
      Flag.withSchema(Schema.fromJsonString(Schema.Json))
    );
  })();
  const described =
    property.description === undefined
      ? base
      : base.pipe(Flag.withDescription(property.description));
  return required ? described : described.pipe(Flag.optional);
}

/** The metavariable a flag shows in a usage line. */
function hintFor(property: Property): string {
  if (property.enum !== undefined) {
    return property.enum.join("|");
  }
  return property.type ?? "json";
}

/**
 * The input one derived command passes: every property flag that was given, and nothing for those left out.
 * BOUNDARY: Effect's CLI parses a dynamically built config into an untyped record; each value is read back as JSON.
 */
function inputFrom(names: readonly string[], parsed: unknown): CapabilityInput {
  const given = names.flatMap((name) => {
    const value: unknown = Predicate.hasProperty(parsed, name)
      ? parsed[name]
      : undefined;
    if (Option.isOption(value)) {
      return Option.isSome(value) ? [[name, value.value]] : [];
    }
    return value === undefined ? [] : [[name, value]];
  });
  return Schema.decodeUnknownSync(CapabilityInputSchema)(
    Object.fromEntries(given)
  );
}

/** The leaves the `cli` target serves, with their canonical input schemas. */
function servedDefinitions(): readonly {
  readonly definition: DescribableCapability;
  readonly input: typeof InputJsonSchema.Type;
}[] {
  return walkDefinitions(definitions)
    .filter((definition) => servesTarget(definition.audience, "cli"))
    .map((definition) => {
      const program = Effect.runSync(definition.load);
      const document = Schema.toJsonSchemaDocument(program.input).schema;
      return {
        definition,
        input: Schema.decodeUnknownSync(InputJsonSchema)(document),
      };
    });
}

/** The command one leaf becomes: its path from the id, a flag per input property, and the session's own flags. */
function leafCommand(
  definition: DescribableCapability,
  input: typeof InputJsonSchema.Type,
  invoke: InvokeCapability
) {
  const properties = input.properties ?? {};
  const required = new Set(input.required);
  const names = Object.keys(properties);
  const clash = names.find((name) => name in sessionFlags);
  if (clash !== undefined) {
    throw new Error(
      `${definition.id} has an input named ${clash}, which the command line reserves for its session`
    );
  }
  const config = {
    ...sessionFlags,
    ...Object.fromEntries(
      names.map((name) => [
        name,
        flagFor(name, properties[name] ?? {}, required.has(name)),
      ])
    ),
  };
  const path = definition.id.split(".");
  const command = Command.make(path.at(-1) ?? definition.id, config, (parsed) =>
    invoke(sessionFlagsOf(parsed), definition.id, inputFrom(names, parsed))
  ).pipe(Command.withDescription(definition.description));
  const derived: DerivedCommand = {
    description: definition.description,
    flags: names.map((name) => ({
      hint: hintFor(properties[name] ?? {}),
      name,
    })),
    id: definition.id,
    path,
  };
  return { command, derived, path };
}

/**
 * A command for every leaf the `cli` target serves, derived from the catalog: the id `primes.history.list` becomes
 * `primes history list`, and each input property becomes a flag (`--n 97` or `--n=97`). A new leaf whose audience
 * names `cli` gets its command without a change here.
 */
export function capabilityCommands(invoke: InvokeCapability) {
  const leaves = servedDefinitions().map(({ definition, input }) =>
    leafCommand(definition, input, invoke)
  );
  return {
    commands: group(
      leaves.map(({ command, path }) => ({ leaf: command, path }))
    ),
    derived: leaves.map(({ derived }) => derived),
  };
}

/** Nest leaves by the words of their ids, so `primes.check` and `primes.history.list` share `primes`. */
function group(
  leaves: readonly {
    readonly leaf: CapabilityCommand;
    readonly path: readonly string[];
  }[],
  prefix: readonly string[] = []
): CapabilityCommand[] {
  const byFirstWord = new Map<
    string,
    { readonly leaf: CapabilityCommand; readonly path: readonly string[] }[]
  >();
  const commands: CapabilityCommand[] = [];
  for (const entry of leaves) {
    if (entry.path.length === 1) {
      commands.push(entry.leaf);
      continue;
    }
    const [first = ""] = entry.path;
    const siblings = byFirstWord.get(first) ?? [];
    siblings.push({ leaf: entry.leaf, path: entry.path.slice(1) });
    byFirstWord.set(first, siblings);
  }
  for (const [word, children] of byFirstWord) {
    const namespace = [...prefix, word];
    const nested = group(children, namespace);
    const [head, ...rest] = nested;
    if (head === undefined) {
      continue;
    }
    commands.push(
      Command.make(word).pipe(
        Command.withDescription(`The ${namespace.join(".")} capabilities.`),
        Command.withSubcommands([head, ...rest])
      )
    );
  }
  return commands;
}
