import { defineConfig } from "vitest/config";

/** The domain's own tests: the lifecycle below AcidCat. Nothing retries. */
export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 120_000,
    include: ["src/**/*.test.ts"],
    retry: 0,
    testTimeout: 120_000,
  },
});
