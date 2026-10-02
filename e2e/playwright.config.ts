import { once } from "node:events";
import { createServer } from "node:net";

import { defineConfig, devices } from "@playwright/test";
import { Predicate } from "effect";

/** BOUNDARY: A port nothing else is listening on, read from the socket the system assigned it to. */
async function freePort(): Promise<number> {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address: unknown = server.address();
  server.close();
  await once(server, "close");
  if (
    !Predicate.hasProperty(address, "port") ||
    !Predicate.isNumber(address.port)
  ) {
    throw new TypeError("The system assigned no TCP port");
  }
  return address.port;
}

// Workers load this file again, so the port the runner chose travels to them through the environment.
process.env.HEB_STACK_PORT ??= String(await freePort());
const port = Number(process.env.HEB_STACK_PORT);
const origin = `http://localhost:${String(port)}`;

/**
 * The browser scenario runs against the built page served by the API Worker
 * under `alchemy dev`, in workerd, so a check travels the same capnweb route it
 * travels when deployed. The `e2e` stage keeps its state apart from yours.
 */
export default defineConfig({
  expect: { timeout: 60_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "../.artifacts/playwright",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: [["list"]],
  retries: 0,
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  // Hang guards, not paces: a healthy action or assertion settles in well under a second.
  timeout: 5 * 60_000,
  use: {
    actionTimeout: 60_000,
    baseURL: origin,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec alchemy dev --stage e2e",
    cwd: "../workers/api",
    env: { HEB_STACK_PORT: String(port) },
    reuseExistingServer: false,
    timeout: 5 * 60_000,
    url: `${origin}/`,
  },
});
