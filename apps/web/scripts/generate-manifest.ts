/**
 * Derive the build-time documents from the descriptor tree, so JSON Schema conversion never ships to the browser:
 *
 * - `manifest <file>`: the WebMCP manifest the page fetches, with every leaf's description and input JSON Schema.
 * - `catalog <file>`: the AcidCat catalog in canonical form, which `acid-cat check` validates. With `--check`, write
 *   nothing and fail when the committed catalog differs from the definitions.
 *
 * Usage: node scripts/generate-manifest.ts manifest <file>
 *        node scripts/generate-manifest.ts catalog <file> [--check]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Catalog } from "@acid-cat/catalog";
import type { Schema as JsonSchema } from "@acid-cat/catalog";
import { walkDefinitions } from "@heb-stack/acidcat-kernel";
import type { SessionTarget } from "@heb-stack/acidcat-kernel";
import { definitions } from "@heb-stack/acidcat/catalog";
import { buildManifest } from "@heb-stack/webmcp-adapter/manifest";
import { Effect, Option, Schema } from "effect";

/** The bindings each session target is served through; `hs:capnweb` is this application's own capnweb API. */
const TARGET_BINDINGS: Record<SessionTarget, readonly string[]> = {
  cli: ["cli"],
  mcp: ["mcp"],
  rpc: ["hs:capnweb"],
  web: ["typescript", "webmcp"],
};

/** The tag a failure schema fixes for `_tag`. */
const FailureTagSchema = Schema.Struct({
  properties: Schema.Struct({
    _tag: Schema.Struct({ enum: Schema.Tuple([Schema.String]) }),
  }),
});

/** A schema as the JSON Schema 2020-12 document a catalog carries. */
function jsonSchema(schema: Schema.Top): JsonSchema {
  return Schema.toJsonSchemaDocument(schema).schema;
}

/** Effect writes an empty struct as "not null", because an empty object type accepts almost any value; an input is an object. */
function inputSchema(schema: Schema.Top): JsonSchema {
  const document = jsonSchema(schema);
  return Object.keys(document).length === 1 && "not" in document
    ? { type: "object" }
    : document;
}

/** A failure schema keyed by its tag. `Schema.Never`, which declares no failure, has none. */
function failuresOf(schema: Schema.Top): Readonly<Record<string, JsonSchema>> {
  const failure = jsonSchema(schema);
  return Option.match(Schema.decodeUnknownOption(FailureTagSchema)(failure), {
    onNone: () => ({}),
    onSome: ({ properties }) => ({ [properties._tag.enum[0]]: failure }),
  });
}

/** The catalog of every leaf: its audience, its schemas, and each failure by tag. */
const renderCatalog = Effect.gen(function* () {
  const catalog = new Catalog({
    description:
      "A prime checker: check a number, find the next prime, and keep a history of checks.",
    title: "heb-stack",
  });
  for (const [name, bindings] of Object.entries(TARGET_BINDINGS)) {
    catalog.target(name, { bindings });
  }
  for (const definition of walkDefinitions(definitions)) {
    const program = yield* definition.load;
    catalog.capability(definition.id, {
      audience: definition.audience,
      description: definition.description,
      failures: failuresOf(program.error),
      input: inputSchema(program.input),
      output: jsonSchema(program.output),
    });
  }
  return catalog.render();
});

const [mode, output, flag] = process.argv.slice(2);
if (output === undefined || (mode !== "manifest" && mode !== "catalog")) {
  throw new Error(
    "Usage: generate-manifest.ts manifest|catalog <file> [--check]"
  );
}
const file = path.resolve(output);

async function write(text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf-8");
}

if (mode === "manifest") {
  const manifest = await Effect.runPromise(buildManifest(definitions));
  await write(`${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(
    `${file}: ${String(manifest.capabilities.length)} capabilities\n`
  );
} else if (flag === "--check") {
  const text = await Effect.runPromise(renderCatalog);
  const committed = await readFile(file, "utf-8").catch(() => null);
  if (committed !== text) {
    process.stderr.write(
      `${file} is stale: run \`moon run web:catalog\` and commit it\n`
    );
    process.exit(1);
  }
  process.stdout.write(`${file} matches the capability definitions\n`);
} else {
  await write(await Effect.runPromise(renderCatalog));
  process.stdout.write(`${file}: written from the capability definitions\n`);
}
