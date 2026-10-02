import { fileURLToPath, URL } from "node:url";

import cssforge from "@hebilicious/cssforge-unplugin/vite";
import { vize } from "@vizejs/vite-plugin";
import { defineConfig } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The token stylesheet is generated from the typed CSSForge configuration inside the build, so a token edit restyles
// the page without a generation step.
export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: fileURLToPath(new URL("dist", import.meta.url)),
    target: "es2024",
  },
  plugins: [
    cssforge({ config: here("cssforge.config.ts") }),
    vize({
      configFile: here("vize.config.ts"),
      scanPatterns: ["src/**/*.vue"],
      vapor: true,
    }),
  ],
  root: fileURLToPath(new URL(".", import.meta.url)),
});
