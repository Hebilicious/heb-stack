import { defineConfig } from "vize";

export default defineConfig({
  name: "heb-stack-web",
  files: ["apps/web/src/**/*.vue", "apps/web/src/**/*.ts"],
  compiler: {
    vapor: true,
  },
  linter: {
    preset: "essential",
  },
  typeChecker: {
    enabled: true,
    tsconfig: "apps/web/tsconfig.json",
  },
  formatter: {
    printWidth: 120,
    sortAttributes: false,
  },
  vite: {
    scanPatterns: ["apps/web/src/**/*.vue"],
  },
});
