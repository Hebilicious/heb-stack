import { defineConfig } from "vite-plus/test/config";

/** The Node evidence: the capabilities, the targets and the adapters. Nothing retries, and every timeout is a hang guard rather than a pace. */
export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 120_000,
    include: ["primes/**/*.test.ts", "adapters/**/*.test.ts"],
    retry: 0,
    testTimeout: 120_000,
  },
});
