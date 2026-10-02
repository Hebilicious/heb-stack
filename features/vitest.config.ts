import { createRequire } from "node:module";
import path from "node:path";

import { vize } from "@vizejs/vite-plugin";
import { defineConfig } from "vitest/config";

/** A path in the checkout this project sits in. */
const repository = (relative: string) =>
  path.resolve(import.meta.dirname, "..", relative);

/**
 * Vue's bundler builds, which the page ships. Node resolves `vue` through its
 * `node` condition to the CommonJS build, which carries no Vapor runtime, so
 * component evidence names the bundler build of `vue` and of every runtime
 * package it imports, and the page mounts against the Vue it is built for.
 */
const vueRequire = createRequire(
  createRequire(import.meta.url).resolve("vue/package.json")
);
const bundlerBuild = (name: string, file: string) =>
  path.join(
    path.dirname(vueRequire.resolve(`${name}/package.json`)),
    "dist",
    file
  );
const vueAliases = [
  {
    find: /^vue$/u,
    replacement: bundlerBuild("vue", "vue.runtime.esm-bundler.js"),
  },
  ...[
    "runtime-vapor",
    "runtime-dom",
    "runtime-core",
    "reactivity",
    "shared",
  ].map((name) => ({
    find: new RegExp(`^@vue/${name}$`, "u"),
    replacement: bundlerBuild(`@vue/${name}`, `${name}.esm-bundler.js`),
  })),
];

/**
 * Two projects: Node evidence (the capabilities, the targets and the adapters)
 * and component evidence, which compiles the page's Vapor components with vize
 * and mounts them in happy-dom. Nothing retries, and every timeout is a hang
 * guard rather than a pace.
 */
export default defineConfig({
  test: {
    hookTimeout: 120_000,
    projects: [
      {
        test: {
          environment: "node",
          include: ["primes/**/*.test.ts", "adapters/**/*.test.ts"],
          name: "node",
        },
      },
      {
        plugins: [
          vize({
            configFile: repository("apps/web/vize.config.ts"),
            root: repository("apps/web"),
            vapor: true,
          }),
        ],
        resolve: { alias: vueAliases },
        test: {
          environment: "happy-dom",
          include: ["web/**/*.test.ts"],
          name: "component",
          // Inlined so its `vue` import takes the alias above: the atoms must
          // observe the same Vue the page renders.
          server: { deps: { inline: ["@effect/atom-vue"] } },
        },
      },
    ],
    retry: 0,
    testTimeout: 120_000,
  },
});
