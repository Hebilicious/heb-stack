import { spawn } from "node:child_process";
import { once } from "node:events";
import { stat } from "node:fs/promises";

import { Schema } from "effect";

/**
 * How long one adapter run may take before the harness stops it.
 *
 * This is a hang guard, far above healthy latency: the slowest run here checks one number in well under a second, so three
 * minutes turns a hang into a failure with a trace instead of a proof that never settles. It is a harness limit, never
 * an application cutoff, so a run it stops is diagnostic evidence and not a product result.
 */
const RUN_TIMEOUT_MS = 180_000;

/** One run of a bundled adapter: its answer on stdout, its diagnostics on stderr, and the status it exited with. */
export interface AdapterProcessRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
}

/**
 * Run one bundled Node adapter and keep its answer.
 *
 * A Node adapter answers in JSON and reports a domain failure with a non-zero exit, so a proof has to read stdout from
 * a failed run as well as a successful one: the run is returned whatever status it exited with.
 */
export async function runBuiltAdapter(
  entry: string,
  ...args: readonly string[]
): Promise<AdapterProcessRun> {
  const child = spawn(process.execPath, [entry, ...args], {
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: RUN_TIMEOUT_MS,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf-8").on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf-8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  await once(child, "close");
  // A child the hang guard killed has no exit code; it failed.
  return { status: child.exitCode ?? 1, stderr, stdout };
}

/** Require a bundled adapter to be on disk before a run reads a stale or missing bundle as an answer. */
export async function requireBuiltAdapter(
  entry: string,
  buildTarget: string
): Promise<void> {
  const file = await stat(entry).catch(() => null);
  if (file?.isFile() !== true) {
    throw new Error(`${entry} is missing; run moon run ${buildTarget}`);
  }
}

/** Decode one adapter's JSON answer with the schema that owns its shape. */
export function decodeAdapterAnswer<Value>(
  schema: Schema.Codec<Value, unknown>,
  json: string
): Value {
  return Schema.decodeUnknownSync(schema)(JSON.parse(json));
}
