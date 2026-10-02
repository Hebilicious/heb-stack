import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

/** BOUNDARY: A port nothing else is listening on, read from the socket the system assigned it to. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (address !== null && typeof address === "object" ? resolve(address.port) : reject(address)));
    });
  });
}

// Workers load this file again, so the port the runner chose travels to them through the environment.
process.env["PLAYWRIGHT_PORT"] ??= String(await freePort());
const port = Number(process.env["PLAYWRIGHT_PORT"]);

/**
 * The browser scenario runs against the built page served by the API Worker under `cf dev`, so a check travels the
 * same capnweb route it travels in production.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  // Hang guards, not paces: a healthy action or assertion settles in well under a second.
  timeout: 5 * 60_000,
  expect: { timeout: 60_000 },
  reporter: [["list"]],
  outputDir: ".artifacts/playwright",
  use: {
    baseURL: `http://127.0.0.1:${String(port)}`,
    actionTimeout: 60_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec cf dev --mode local --port ${String(port)}`,
    cwd: "workers/api",
    url: `http://127.0.0.1:${String(port)}/`,
    reuseExistingServer: false,
    timeout: 5 * 60_000,
  },
});
