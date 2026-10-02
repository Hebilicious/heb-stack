import { walkDefinitions } from "@heb-stack/acidcat-kernel";
import type { DefinitionCatalog } from "@heb-stack/acidcat-kernel";
import { Effect, Schema } from "effect";

export const ManifestEntrySchema = Schema.Struct({
  description: Schema.String.check(Schema.isMaxLength(1000)),
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(160)),
  inputSchema: Schema.Record(Schema.String, Schema.Json),
});

/** What the page fetches before it registers tools: every leaf's description and canonical input JSON Schema. */
export const ManifestSchema = Schema.Struct({
  capabilities: Schema.Array(ManifestEntrySchema).check(
    Schema.isMaxLength(256)
  ),
  version: Schema.Literal(1),
});
export type AcidCatManifest = typeof ManifestSchema.Type;

/**
 * Derive the manifest from the descriptor tree at build time, so JSON Schema conversion never ships to the page.
 */
export const buildManifest = Effect.fn("buildManifest")(function* (
  definitions: DefinitionCatalog
) {
  const capabilities = yield* Effect.forEach(
    walkDefinitions(definitions),
    (definition) =>
      definition.load.pipe(
        Effect.map((program) => ({
          description: definition.description,
          id: definition.id,
          inputSchema: Schema.toJsonSchemaDocument(program.input).schema,
        }))
      )
  );
  return yield* Schema.decodeUnknownEffect(ManifestSchema)({
    capabilities,
    version: 1,
  });
});
