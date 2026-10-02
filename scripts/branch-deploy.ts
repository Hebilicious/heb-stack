/**
 * Upload the checked-out branch as a Cloudflare Worker version under its own preview alias, then prove the preview
 * answers the page, `/rpc`, and `/mcp`.
 *
 * `cf workers versions create` uploads a version without deploying it, so the Worker's live deployment and every route
 * it serves stay as they were. The account comes from `cf auth` or `CLOUDFLARE_ACCOUNT_ID`, never from this repository.
 *
 * Usage: node scripts/branch-deploy.ts
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { newHttpBatchRpcSession } from "capnweb";
import type { PrimesApi } from "@heb-stack/rpc";

const WORKER_NAME = "heb-stack";

/**
 * Cloudflare derives a preview hostname as `<alias>-<worker name>`, and a DNS label holds at most 63 characters, so the
 * alias keeps a slug of the branch and a digest that tells two long branches apart.
 */
export function previewAlias(branch: string): string {
  const digest = createHash("sha256").update(branch).digest("hex").slice(0, 8);
  const room = 63 - WORKER_NAME.length - 1 - "branch-".length - digest.length - 1;
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, room)
    .replace(/-+$/u, "");
  return `branch-${slug.length === 0 ? "change" : slug}-${digest}`;
}

function runCf(args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "cf", ...args], { cwd: "workers/api", stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      process.stdout.write(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(output) : reject(new Error(`cf exited with ${String(code)}`))));
  });
}

async function verify(previewUrl: string): Promise<void> {
  const page = await fetch(previewUrl);
  if (!page.ok || !(await page.text()).includes('id="app"')) throw new Error(`${previewUrl} did not serve the page`);

  const mcp = await fetch(`${previewUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "tools/list",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  const listing = await mcp.text();
  if (!mcp.ok || !listing.includes('"primes.next"')) throw new Error(`/mcp answered ${String(mcp.status)}: ${listing}`);

  const origin = new URL(previewUrl).origin;
  const session = newHttpBatchRpcSession<PrimesApi>(
    new Request(`${origin}/rpc`, { method: "POST", headers: { Origin: origin } }),
  );
  try {
    const answer = JSON.stringify(await session.check({ n: 91 }));
    if (!answer.includes('"smallestFactor":7')) throw new Error(`/rpc answered ${answer}`);
  } finally {
    session[Symbol.dispose]();
  }
  process.stdout.write(`Verified ${previewUrl}: the page, /mcp tools/list, and /rpc check all answer.\n`);
}

const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
if (branch === "" || branch === "main") throw new Error("A branch preview needs a checked-out branch other than main");
const alias = previewAlias(branch);
process.stdout.write(`Uploading ${WORKER_NAME} as preview alias ${alias} for ${branch}.\n`);
const output = await runCf(["workers", "versions", "create", "--mode", "preview", "--preview-alias", alias]);
const previewUrl = output.match(/Version Preview Alias URL:\s+(https:\/\/\S+)/u)?.[1];
if (previewUrl === undefined) throw new Error("cf reported no preview alias URL");
await verify(previewUrl.replace(/\/$/u, ""));
