import { bindings, defineConfig, defineWorker } from "cf/config";

/**
 * The API Worker: the built page as assets, capnweb at `/rpc`, and MCP at `/mcp`.
 *
 * The account comes from `CLOUDFLARE_ACCOUNT_ID`, so no account or zone ID lives in the repository. Every command names
 * its mode: `local` for `cf dev`, `preview` for an aliased version upload that leaves the live deployment untouched.
 */
function apiWorker(surface: { readonly workersDev: boolean; readonly previewUrls: boolean }) {
  return defineWorker({
    name: "heb-stack",
    compatibilityDate: "2026-09-30",
    entrypoint: "./src/index.ts",
    assets: { notFoundHandling: "single-page-application", runWorkerFirst: ["/rpc", "/mcp"] },
    env: { ASSETS: bindings.assets() },
    ...surface,
  });
}

export const localWorker = apiWorker({ workersDev: false, previewUrls: false });

// Preview URLs are served from workers.dev, which this mode enables for the Worker; it routes no custom domain.
export const previewWorker = apiWorker({ workersDev: true, previewUrls: true });

const WORKERS = new Map([
  ["local", localWorker],
  ["preview", previewWorker],
]);

export default defineConfig(({ mode }) => {
  const worker = mode === undefined ? undefined : WORKERS.get(mode);
  if (worker === undefined) throw new Error(`The API Worker has no mode named ${String(mode)}; use local or preview.`);
  return { worker };
});
