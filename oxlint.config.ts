import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";
import vue from "ultracite/oxlint/vue";

/**
 * Ultracite's core, Vue and Vitest presets, with the vendored anti-slop rules and this repository's Effect rules on
 * top. `tools/oxlint/anti-slop/README.md` explains the anti-slop rules that stay off. Three Ultracite rules are
 * adjusted, each kept to its intent:
 *
 * - `func-style` asks for one style; this code declares named functions and keeps arrows for callbacks.
 * - `no-use-before-define` still reports a read before definition in the same scope, which throws; a hoisted function,
 *   or a constant read inside a function declared above it, may sit below its caller, so a module reads top-down.
 * - `func-names` leaves generators alone: `Effect.gen(function* () {…})` is Effect's own idiom.
 */
export default defineConfig({
  extends: [core, vue, vitest],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ".artifacts/**",
    "**/.alchemy/**",
    "**/.vize/**",
    "**/dist/**",
    "crates/**/target/**",
    "apps/web/public/**",
    "tools/oxlint/anti-slop/**",
  ],
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: "./tools/oxlint/anti-slop/index.ts",
    },
    {
      name: "anti-slop-effect",
      specifier: "./tools/oxlint/anti-slop/effect/index.ts",
    },
  ],
  overrides: [
    {
      files: [
        "apps/web/**",
        "tools/**",
        "scripts/**",
        "features/**",
        "e2e/**",
        "**/*.config.ts",
        "**/*.test.ts",
      ],
      // Browser presentation, tooling, configuration and evidence are not shared by the requests an isolate serves.
      rules: { "anti-slop/no-module-level-mutable-state": "off" },
    },
  ],
  rules: {
    "anti-slop-effect/no-application-bypass": "error",
    "anti-slop-effect/no-effect-ports": "error",
    "anti-slop-effect/no-manual-effect-error-tag": "error",
    "anti-slop-effect/no-manual-effect-runtime-in-evidence": "error",
    "anti-slop-effect/no-manual-tag-comparison": "error",
    "anti-slop-effect/no-manual-tagged-construction": "error",
    "anti-slop-effect/no-xstate-promise-actors-with-effect": "error",
    "anti-slop-effect/require-capability-files": "error",
    "anti-slop-effect/require-effect-computations": "error",
    "anti-slop-effect/require-machine-files": "error",
    "anti-slop-effect/require-xstate-v6": "error",
    "anti-slop-effect/use-atom-runtime-in-vue": "error",
    "anti-slop-effect/use-effect-actor-host": "error",
    "anti-slop-effect/use-effect-schema": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": [
      "error",
      {
        allowWithBoundaryComment: true,
      },
    ],
    "anti-slop/no-module-level-mutable-state": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": [
      "error",
      {
        allowWithBoundaryComment: true,
      },
    ],
    "anti-slop/no-reduce-accumulator-copy": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": [
      "error",
      {
        allowWithBoundaryComment: true,
      },
    ],
    "anti-slop/no-runtime-typeof": [
      "error",
      {
        allowInTypeGuards: true,
        allowWithBoundaryComment: true,
      },
    ],
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unbounded-wait": "error",
    "anti-slop/no-unknown-parameters": [
      "error",
      {
        allowInTypeGuards: true,
        allowWithBoundaryComment: true,
      },
    ],
    "anti-slop/no-unknown-returns": [
      "error",
      {
        allowWithBoundaryComment: true,
      },
    ],
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": [
      "error",
      {
        allowWithBoundaryComment: true,
      },
    ],
    "anti-slop/no-wall-clock-budget": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "func-names": ["error", "as-needed", { generators: "never" }],
    "func-style": ["error", "declaration", { allowArrowFunctions: true }],
    "no-use-before-define": [
      "error",
      { classes: true, functions: false, variables: false },
    ],
  },
  // The AcidCat domains: `packages/<domain>`, published as `<scope>/<domain>`. Only `packages/acidcat` may import them.
  settings: { acidcat: { domains: ["primes"], scope: "@heb-stack" } },
});
