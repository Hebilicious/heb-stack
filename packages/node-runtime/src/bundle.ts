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
    build: {
      emptyOutDir: true,
      outDir: options.outDir,
      rolldownOptions: { output: { entryFileNames: "main.js", format: "esm" } },
      ssr: options.entry,
      target: "node24",
    },
    ssr: { noExternal: true, target: "node" },
  });
}
