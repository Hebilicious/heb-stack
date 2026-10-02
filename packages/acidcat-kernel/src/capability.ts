import type { Effect, Schema } from "effect";
import {
  constantSource,
  type Availability,
  type AvailabilitySource,
  type ReadonlySnapshotSource,
} from "./projection.ts";

export const capabilityTypeId: unique symbol = Symbol.for("@heb-stack/acidcat/Capability");

/**
 * What a session is for. `web` is the page: Vue interaction and the WebMCP tools that drive it. `cli`, `mcp`, and
 * `rpc` are tool surfaces, and a capability reaches one only when its audience names it.
 */
export type SessionTarget = "web" | "cli" | "mcp" | "rpc";

export interface CapabilityProgram<Input, Output, Failure, Requirements> {
  readonly input: Schema.Codec<Input, unknown>;
  readonly output: Schema.Codec<Output, unknown>;
  readonly error: Schema.Codec<Failure, unknown>;
  readonly run: (input: Input) => Effect.Effect<Output, Failure, Requirements>;
}

export interface CapabilityDefinition<Id extends string, Input, Output, Failure, Requirements> {
  readonly [capabilityTypeId]: true;
  readonly id: Id;
  readonly description: string;
  /**
   * The targets allowed to see this capability, declared where the capability is defined. A session created for a
   * target outside this list never registers the leaf and refuses a direct call, so a tool surface grows one
   * deliberate declaration at a time.
   */
  readonly audience: readonly SessionTarget[];
  readonly load: Effect.Effect<CapabilityProgram<Input, Output, Failure, Requirements>>;
}

export function defineCapability<const Id extends string, Input, Output, Failure, Requirements>(
  definition: Omit<CapabilityDefinition<Id, Input, Output, Failure, Requirements>, typeof capabilityTypeId>,
): CapabilityDefinition<Id, Input, Output, Failure, Requirements> {
  return Object.freeze({ ...definition, [capabilityTypeId]: true as const });
}

export function servesTarget(audience: readonly SessionTarget[], target: SessionTarget): boolean {
  return audience.includes(target);
}

/** The refusal a capability outside a target's audience reports wherever its availability is read. */
export function unavailableSource(reason: string): AvailabilitySource {
  const availability: Availability = Object.freeze({ available: false as const, reason });
  return constantSource(availability);
}

export type Result<Output, Failure> =
  | { readonly ok: true; readonly value: Output }
  | { readonly ok: false; readonly error: Failure };

export interface ExecuteOptions {
  readonly signal?: AbortSignal;
}

export interface CapabilityHandle<Id extends string, Input, Output, Failure, Snapshot = never> {
  readonly [capabilityTypeId]: true;
  readonly id: Id;
  readonly description: string;
  /** The targets that may see this capability, copied from its definition. */
  readonly audience: readonly SessionTarget[];
  readonly availability: AvailabilitySource;
  readonly snapshot?: ReadonlySnapshotSource<Snapshot>;
  execute(this: void, input: Input, options?: ExecuteOptions): Promise<Result<Output, Failure>>;
  /** BOUNDARY: The root decodes external invocation input with the leaf’s canonical schema. */
  invokeExternal(input: unknown, options?: ExecuteOptions): Promise<Result<unknown, unknown>>;
}

export interface ExternalCapability {
  readonly [capabilityTypeId]: true;
  readonly id: string;
  readonly description: string;
  /** The targets that may see this capability, copied from its definition. */
  readonly audience: readonly SessionTarget[];
  readonly availability: AvailabilitySource;
  /** BOUNDARY: The root decodes external invocation input with the leaf’s canonical schema. */
  invokeExternal(input: unknown, options?: ExecuteOptions): Promise<Result<unknown, unknown>>;
}

export type Catalog = { readonly [key: string]: ExternalCapability | Catalog };

/** Build tools traverse these same definitions without acquiring any application owner. */
export interface DescribableCapability {
  readonly [capabilityTypeId]: true;
  readonly id: string;
  readonly description: string;
  /** The targets allowed to see this capability, which the conformance walk checks. */
  readonly audience: readonly SessionTarget[];
  /** A definition loads its canonical program, whose schemas are whole schemas rather than a structural view. */
  readonly load: Effect.Effect<{
    readonly input: Schema.Top;
    readonly output: Schema.Top;
    readonly error: Schema.Top;
  }>;
}

export type DefinitionCatalog = { readonly [key: string]: DescribableCapability | DefinitionCatalog };

export function walkDefinitions(catalog: DefinitionCatalog): readonly DescribableCapability[] {
  return Object.values(catalog).flatMap((value) => (capabilityTypeId in value ? [value] : walkDefinitions(value)));
}

/** One capability with the top-level catalog key that owns it, as a generic adapter sees it. */
export interface CatalogEntry {
  readonly domain: string;
  readonly capability: ExternalCapability;
}

/**
 * Walk a catalog into its capabilities, each with its owning top-level key.
 *
 * Registration, listing, and invocation are one walk, and keeping the key beside the capability is what stops every
 * adapter from walking the catalog for itself.
 */
export function walkCatalogEntries(catalog: Catalog): readonly CatalogEntry[] {
  return Object.entries(catalog).flatMap(([domain, value]) => catalogEntriesOf(domain, value));
}

function catalogEntriesOf(domain: string, value: ExternalCapability | Catalog): readonly CatalogEntry[] {
  if (capabilityTypeId in value) return [{ domain, capability: value }];
  return Object.values(value).flatMap((nested) => catalogEntriesOf(domain, nested));
}

export function walkCapabilities(catalog: Catalog): readonly ExternalCapability[] {
  return walkCatalogEntries(catalog).map((entry) => entry.capability);
}

/** The leaves a session serves: in the target's audience and available from their owner now. */
export function servedCapabilities(catalog: Catalog, target: SessionTarget): readonly ExternalCapability[] {
  return walkCapabilities(catalog).filter(
    (leaf) => servesTarget(leaf.audience, target) && leaf.availability.getSnapshot().available,
  );
}
