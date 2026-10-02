import { fileURLToPath, URL } from "node:url";
import cssforge from "@hebilicious/cssforge-unplugin/vite";
import vize from "@vizejs/vite-plugin";
import { defineConfig } from "vite";

const repository = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

// The token stylesheet is generated from the typed CSSForge configuration inside the build, so a token edit restyles
// the page without a generation step.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    cssforge({ config: repository("cssforge.config.ts") }),
    vize({ configFile: repository("vize.config.ts"), vapor: true, scanPatterns: ["src/**/*.vue"] }),
  ],
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    target: "es2024",
  },
});
