import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import { Schema } from "effect";

const execute = promisify(execFile);

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
 * a failed run as well as a successful one. This helper owns that: `execFile` rejects with the child's own object on a
 * non-zero exit, and the rejection is turned back into the run it describes.
 */
export async function runBuiltAdapter(entry: string, ...args: readonly string[]): Promise<AdapterProcessRun> {
  try {
    const { stdout, stderr } = await execute(process.execPath, [entry, ...args], {
      cwd: process.cwd(),
      maxBuffer: 64 * 1024 * 1024,
      timeout: RUN_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    return { stdout, stderr, status: 0 };
  } catch (error) {
    return failedRun(error);
  }
}

/* BOUNDARY: A non-zero exit rejects with a Node error object carrying the child's stdout and its exit code. */
function failedRun(error: unknown): AdapterProcessRun {
  const stdout = fieldOf(error, "stdout");
  const stderr = fieldOf(error, "stderr");
  const code = fieldOf(error, "code");
  return {
    stdout: typeof stdout === "string" ? stdout : "",
    stderr: typeof stderr === "string" ? stderr : "",
    status: typeof code === "number" ? code : 1,
  };
}

/** Require a bundled adapter to be on disk before a run reads a stale or missing bundle as an answer. */
export async function requireBuiltAdapter(entry: string, buildTarget: string): Promise<void> {
  const file = await stat(entry).catch(() => null);
  if (file?.isFile() !== true) throw new Error(`${entry} is missing; run moon run app:${buildTarget}`);
}

/** Decode one adapter's JSON answer with the schema that owns its shape. */
export function decodeAdapterAnswer<Value>(schema: Schema.Codec<Value, unknown>, json: string): Value {
  return Schema.decodeUnknownSync(schema)(JSON.parse(json));
}

/* BOUNDARY: A property read from an untrusted value; a primitive or null carries none. */
function fieldOf(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}
