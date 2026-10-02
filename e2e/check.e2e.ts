import { expect, test } from "@playwright/test";

test("a check travels over capnweb, and the history survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  const number = page.getByLabel("Number");
  const status = page.getByRole("status");
  const checks = page
    .getByRole("list", { name: "Checks" })
    .getByRole("listitem");

  const answered = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/rpc" &&
      response.request().method() === "POST"
  );
  await number.fill("91");
  const rpc = await answered;
  expect(rpc.status()).toBe(200);
  expect(await rpc.text()).toContain('"smallestFactor":7');
  await expect(status).toHaveText("91 = 7 × 13");

  await number.fill("97");
  await expect(status).toHaveText("97 is prime");
  await expect(checks).toHaveText([/^97 is prime/u, /^91 is composite/u]);

  await page.reload();
  await expect(checks).toHaveText([/^97 is prime/u, /^91 is composite/u]);
});
