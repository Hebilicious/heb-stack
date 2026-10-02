import { defineConfig } from "vite";

export interface AdapterBundleOptions {
  /** The adapter's own entry point, relative to the repository root. */
  readonly entry: string;
  /** The directory the one Node entry point is written to, relative to the repository root. */
  readonly outDir: string;
}

/**
 * The Vite bundle a Node adapter ships as: the workspace TypeScript graph bundled once into `main.js`, so no Moon or
 * TypeScript toolchain runs inside the process a caller starts. The crate is read from disk, not bundled.
 */
export function adapterBundleConfig(options: AdapterBundleOptions) {
  return defineConfig({
    ssr: { noExternal: true, target: "node" },
    build: {
      ssr: options.entry,
      outDir: options.outDir,
      emptyOutDir: true,
      target: "node24",
      rolldownOptions: { output: { format: "esm", entryFileNames: "main.js" } },
    },
  });
}
