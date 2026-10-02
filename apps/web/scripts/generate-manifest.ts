/**
 * Write the WebMCP manifest the page fetches: every leaf's description and canonical input JSON Schema, derived from
 * the descriptor tree so JSON Schema conversion never ships to the browser.
 *
 * Usage: node scripts/generate-manifest.ts <output file>
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { definitions } from "@heb-stack/acidcat/catalog";
import { buildManifest } from "@heb-stack/webmcp-adapter/manifest";
import { Effect } from "effect";

const output = process.argv.at(2);
if (output === undefined) {
  throw new Error("Name the manifest file to write");
}
const manifest = await Effect.runPromise(buildManifest(definitions));
await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
process.stdout.write(
  `${path.resolve(output)}: ${String(manifest.capabilities.length)} capabilities\n`
);
