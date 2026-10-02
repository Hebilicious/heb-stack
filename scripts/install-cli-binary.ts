/**
 * Install the built command line as the `heb-stack` binary inside this checkout.
 *
 * `moon run app:cli-install` builds the bundle, then writes `.artifacts/bin/heb-stack` beside it. The shim execs the
 * bundle with the Node that installed it, so a caller needs neither Moon nor a TypeScript toolchain to run it. Re-run
 * the target after moving the checkout, because the shim names the bundle's absolute path.
 *
 * Usage: node scripts/install-cli-binary.ts [--directory <dir>]
 */
import { existsSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BINARY_NAME = "heb-stack";
const BUNDLE = resolve(".artifacts/cli/main.js");

const directory = option("--directory") ?? resolve(".artifacts", "bin");
if (!existsSync(BUNDLE)) {
  process.stderr.write(`${BUNDLE} is missing; run \`moon run app:cli-build\` first\n`);
  process.exit(1);
}
await mkdir(directory, { recursive: true });
const installed = resolve(directory, BINARY_NAME);
const shim = [
  "#!/bin/sh",
  `# Written by \`moon run app:cli-install\`; it execs the bundle Moon built at ${BUNDLE}.`,
  `exec ${quote(process.execPath)} ${quote(BUNDLE)} "$@"`,
  "",
].join("\n");
await writeFile(installed, shim, "utf8");
await chmod(installed, 0o755);
process.stdout.write(`${installed}\n`);

/** One `--name <value>` argument, or `null` when the caller did not pass it. */
function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return resolve(value);
}

/** BOUNDARY: A shell path is quoted for `/bin/sh`, where a single quote is closed and reopened around itself. */
function quote(value: string): string {
  return `'${value.split("'").join(`'\\''`)}'`;
}
