import { createAcidCat } from "@heb-stack/acidcat";
import { PRIMES_RPC_PATH } from "@heb-stack/rpc";
import { Layer } from "effect";
import { checkHistoryLocalLayer } from "./check-history-local.ts";
import { primeMathRemoteLayer } from "./prime-math-remote.ts";
import { connectBrowserWebMcp } from "./webmcp.ts";

export interface BrowserSessionOptions {
  /** The page's own origin, which serves the capnweb API. */
  readonly origin: string;
  readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  /** The document WebMCP is discovered on; a document without a model context installs no adapter. */
  readonly document: unknown;
}

/** Open the page's session: arithmetic on the Worker, the history in browser storage, and the catalog in WebMCP. */
export async function createBrowserAcidCat(options: BrowserSessionOptions) {
  const root = await createAcidCat(
    { target: "web" },
    Layer.merge(
      primeMathRemoteLayer(new URL(PRIMES_RPC_PATH, options.origin).href),
      checkHistoryLocalLayer(options.storage),
    ),
  );
  try {
    return Object.freeze({ ...root, webmcp: await connectBrowserWebMcp(root, options.document) });
  } catch (cause) {
    await root.dispose();
    throw cause;
  }
}

export type BrowserAcidCat = Awaited<ReturnType<typeof createBrowserAcidCat>>;
export { CHECK_HISTORY_STORAGE_KEY, checkHistoryLocalLayer } from "./check-history-local.ts";
export { MANIFEST_PATH } from "./webmcp.ts";
