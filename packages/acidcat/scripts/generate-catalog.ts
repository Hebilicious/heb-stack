/**
 * Write the AcidCat catalog from the application, in canonical form: the build-time document `acid-cat check`
 * validates. With `--check`, write nothing and fail when the committed catalog differs from the application.
 *
 * Usage: node scripts/generate-catalog.ts <file> [--check]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { App } from "@acid-cat/core-effect";

import { app } from "../src/catalog.ts";

const [output, flag] = process.argv.slice(2);
if (output === undefined) {
  throw new Error("Usage: generate-catalog.ts <file> [--check]");
}
const file = path.resolve(output);
const text = App.render(app);

if (flag === "--check") {
  const committed = await readFile(file, "utf-8").catch(() => null);
  if (committed !== text) {
    process.stderr.write(
      `${file} is stale: run \`moon run acidcat:catalog\` and commit it\n`
    );
    process.exit(1);
  }
  process.stdout.write(`${file} matches the application\n`);
} else {
  await writeFile(file, text, "utf-8");
  process.stdout.write(`${file}: written from the application\n`);
}
