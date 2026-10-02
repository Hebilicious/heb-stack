import { definitions } from "@heb-stack/acidcat/catalog";
import {
  walkCapabilities,
  walkDefinitions,
  type Catalog,
  type ExternalCapability,
  type Result,
} from "@heb-stack/acidcat-kernel";
import { Effect, Option, Schema } from "effect";
import { Tool, Toolkit } from "effect/ai";

/** One capability the endpoint serves, as the MCP server needs it: its contract and its invoker. */
export interface McpToolSource {
  readonly id: string;
  readonly description: string;
  /** The canonical input schema the capability program loads, so a client sees the real contract. */
  readonly input: Schema.Top;
  // BOUNDARY: The client's arguments are unknown until the capability's own decoder reads them.
  readonly invoke: (input: unknown) => Promise<Result<unknown, unknown>>;
}

/**
 * The leaves a session makes available, joined with their canonical contracts.
 *
 * The scoped catalog already answers what this target may see, because a capability outside the audience never
 * reports available. The pure descriptor tree adds only the schemas, so this holds no capability map and nothing
 * has to be kept in step with the generated manifest.
 */
export function servedToolSources(catalog: Catalog): Effect.Effect<readonly McpToolSource[]> {
  const descriptors = new Map(walkDefinitions(definitions).map((descriptor) => [descriptor.id, descriptor]));
  const served = walkCapabilities(catalog).filter((leaf) => leaf.availability.getSnapshot().available);
  return Effect.forEach(served, (leaf) =>
    Effect.gen(function* () {
      const descriptor = descriptors.get(leaf.id);
      if (descriptor === undefined)
        return yield* Effect.die(`The catalog holds ${leaf.id}, which no capability definition declares`);
      const program = yield* descriptor.load;
      return {
        id: leaf.id,
        description: leaf.description,
        input: program.input,
        invoke: (input) => invokeLeaf(leaf, input),
      };
    }),
  );
}

/**
 * Turn the served leaves into the one toolkit the MCP server registers.
 *
 * A capability's canonical failure travels in the tool's error channel, so a refused call reaches the client as an
 * error result carrying the capability's own failure value rather than a transport error.
 */
export function mcpToolkit(sources: readonly McpToolSource[]) {
  const tools: readonly Tool.Any[] = sources.map((source) =>
    Tool.dynamic(source.id, {
      description: source.description,
      parameters: source.input,
      success: Schema.Json,
      failure: Schema.Json,
      failureMode: "error",
    }),
  );
  const toolkit = Toolkit.make(...tools);
  // BOUNDARY: A tool call's arguments are the client's data; the capability's own decoder reads them, so the
  // record that answers the toolkit accepts them unparsed and hands each one to its capability.
  const handlers: Record<string, (input: unknown) => ToolHandler> = {};
  for (const source of sources) {
    handlers[source.id] = (input) => invokeServedTool(source, input);
  }
  return { toolkit, handlers: toolkit.toLayer(handlers) };
}

// BOUNDARY: A tool call's arguments are the client's data; the capability's own decoder reads them.
function invokeLeaf(leaf: ExternalCapability, input: unknown): Promise<Result<unknown, unknown>> {
  return leaf.invokeExternal(input);
}

/** What a tool answers with and fails with, which is the JSON its own schema declares to a client. */
type ToolValue = typeof Schema.Json.Type;
type ToolHandler = Effect.Effect<ToolValue, ToolValue>;

// BOUNDARY: A tool call's arguments are the client's data; the capability's own decoder reads them.
function invokeServedTool(source: McpToolSource, input: unknown): ToolHandler {
  return Effect.tryPromise({
    try: () => source.invoke(input),
    catch: (cause): ToolValue => ({ message: cause instanceof Error ? cause.message : "The tool call failed" }),
  }).pipe(
    Effect.flatMap((result) =>
      result.ok
        ? asToolValue(result.value)
        : asToolValue(result.error).pipe(Effect.flatMap((failure) => Effect.fail(failure))),
    ),
  );
}

/** BOUNDARY: A capability's value is application data; the JSON schema is what its tool declares. */
function asToolValue(value: unknown): Effect.Effect<ToolValue> {
  return Effect.sync(() => Schema.decodeUnknownOption(Schema.Json)(value)).pipe(
    Effect.map(Option.getOrElse((): ToolValue => ({ message: "The capability answered no JSON value" }))),
  );
}

/** The toolkit and the handlers that answer it, as the server layer needs them. */
export type McpToolkit = ReturnType<typeof mcpToolkit>;
