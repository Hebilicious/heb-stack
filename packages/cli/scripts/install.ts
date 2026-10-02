/**
 * Install the built command line as the `heb-stack` binary inside this checkout.
 *
 * `moon run cli:install` builds the bundle, then writes `.artifacts/bin/heb-stack` beside it. The shim execs the
 * bundle with the Node that installed it, so a caller needs neither Moon nor a TypeScript toolchain to run it. Re-run
 * the target after moving the checkout, because the shim names the bundle's absolute path.
 *
 * Usage: node scripts/install.ts [--directory <dir>]
 */
import { existsSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { CLI_BUNDLE_DIRECTORY } from "../src/location.ts";

const BINARY_NAME = "heb-stack";
/** The checkout this script sits in: the bundle and the default binary directory live under its `.artifacts`. */
const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const BUNDLE = path.resolve(ROOT, CLI_BUNDLE_DIRECTORY, "main.js");

const directory =
  option("--directory") ?? path.resolve(ROOT, ".artifacts", "bin");
if (!existsSync(BUNDLE)) {
  process.stderr.write(
    `${BUNDLE} is missing; run \`moon run cli:build\` first\n`
  );
  process.exit(1);
}
await mkdir(directory, { recursive: true });
const installed = path.resolve(directory, BINARY_NAME);
const shim = [
  "#!/bin/sh",
  `# Written by \`moon run cli:install\`; it execs the bundle Moon built at ${BUNDLE}.`,
  `exec ${quote(process.execPath)} ${quote(BUNDLE)} "$@"`,
  "",
].join("\n");
await writeFile(installed, shim, "utf-8");
await chmod(installed, 0o755);
process.stdout.write(`${installed}\n`);

/** One `--name <value>` argument, or `null` when the caller did not pass it. */
function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return path.resolve(value);
}

/** BOUNDARY: A shell path is quoted for `/bin/sh`, where a single quote is closed and reopened around itself. */
function quote(value: string): string {
  return `'${value.split("'").join(`'\\''`)}'`;
}
