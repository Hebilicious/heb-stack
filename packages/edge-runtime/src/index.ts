import { createAcidCat } from "@heb-stack/acidcat";
import type { AcidCat } from "@heb-stack/acidcat";
import { primeMathWasmLayer } from "@heb-stack/acidcat/primes";

export interface EdgeSessionOptions {
  /** The tool surface this request serves. */
  readonly target: "mcp" | "rpc";
  /** The crate, compiled by workerd once when the isolate starts. */
  readonly module: WebAssembly.Module;
}

/**
 * Open the canonical AcidCat session inside a Worker, one per request.
 *
 * An isolate serves every caller, so the session keeps no history: `primes.check` answers without recording, and the
 * history leaves, which neither tool target declares, are never reachable here.
 */
export async function createEdgeAcidCat(
  options: EdgeSessionOptions
): Promise<AcidCat> {
  return await createAcidCat(
    { target: options.target },
    primeMathWasmLayer(options.module)
  );
}
