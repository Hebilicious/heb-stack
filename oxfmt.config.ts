import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

/** Ultracite's formatter settings; vize formats the Vue files, so oxfmt leaves them alone. */
export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/moon.yml",
    ".moon/**/*.yml",
    ".artifacts/**",
    ".vize/**",
    "**/.alchemy/**",

    "**/dist/**",
    "**/node_modules/**",
    "crates/**",
    "apps/web/public/**",
    "apps/web/src/**/*.vue",
    "pnpm-lock.yaml",
  ],
});
