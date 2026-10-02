import { defineConfig } from "vize";

export default defineConfig({
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
    tsconfig: "tsconfig.json",
  },
  vite: {
    scanPatterns: ["src/**/*.vue"],
  },
});
