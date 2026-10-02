import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import vize from "@vizejs/vite-plugin";
import { defineConfig } from "vitest/config";

const repository = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Vue's bundler builds, which the page ships. Node resolves `vue` through its `node` condition to the CommonJS build,
 * which carries no Vapor runtime, so component evidence names the bundler build of `vue` and of every runtime package
 * it imports, and the page's components mount against the same Vue they are built for.
 */
const vueRequire = createRequire(createRequire(import.meta.url).resolve("vue/package.json"));
const vueBundlerBuilds = ["runtime-vapor", "runtime-dom", "runtime-core", "reactivity", "shared"].map((name) => ({
  find: new RegExp(`^@vue/${name}$`, "u"),
  replacement: join(dirname(vueRequire.resolve(`@vue/${name}/package.json`)), "dist", `${name}.esm-bundler.js`),
}));

/**
 * Two projects: Node evidence (domain, adapters, Gherkin features) and component evidence, which compiles the page's
 * Vapor components with vize and mounts them in happy-dom. No retries: evidence fails only for a reason a change
 * controls.
 */
export default defineConfig({
  test: {
    retry: 0,
    // Hang guards, not paces: a hung test fails with a trace instead of holding the gate.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["packages/*/src/**/*.test.ts", "features/primes/**/*.test.ts", "features/adapters/**/*.test.ts"],
        },
      },
      {
        plugins: [vize({ configFile: repository("./vize.config.ts"), vapor: true, root: repository("./apps/web") })],
        resolve: {
          alias: [
            {
              find: /^vue$/u,
              replacement: join(dirname(vueRequire.resolve("./package.json")), "dist", "vue.runtime.esm-bundler.js"),
            },
            ...vueBundlerBuilds,
          ],
        },
        test: {
          name: "component",
          environment: "happy-dom",
          include: ["features/web/**/*.test.ts"],
          // Inlined so its `vue` import takes the alias above: the atoms must observe the same Vue the page renders.
          server: { deps: { inline: ["@effect/atom-vue"] } },
        },
      },
    ],
  },
});
