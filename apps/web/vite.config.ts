import { fileURLToPath, URL } from "node:url";

import cssforge from "@hebilicious/cssforge-unplugin/vite";
import { vize } from "@vizejs/vite-plugin";
import { defineConfig } from "vite-plus";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The token stylesheet is generated from the typed CSSForge configuration inside the build, so a token edit restyles
// the page without a generation step. `vue` holds vize's settings, which the plugin and the vize CLI both read.
export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: here("dist"),
    target: "es2024",
  },
  plugins: [
    cssforge({ config: here("cssforge.config.ts") }),
    vize({ vapor: true }),
  ],
  root: here("."),
  vue: {
    compiler: {
      vapor: true,
    },
    files: ["src/**/*.vue", "src/**/*.ts"],
    formatter: {
      printWidth: 80,
      sortAttributes: false,
    },
    linter: {
      preset: "essential",
    },
    name: "heb-stack-web",
    typeChecker: {
      enabled: true,
    },
    vite: {
      scanPatterns: ["src/**/*.vue"],
    },
  },
});
