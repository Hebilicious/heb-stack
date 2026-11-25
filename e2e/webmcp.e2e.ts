import { expect, test } from "@playwright/test";

test("an agent in the page calls primes.next through WebMCP", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("footer")).toHaveText(
    "The capability catalog is registered as WebMCP tools."
  );

  const answer = await page.evaluate(async () => {
    const context = document.modelContext;
    if (context === undefined) {
      throw new Error("This browser exposes no model context");
    }
    const tools = await context.getTools();
    const next = tools.find((tool) => tool.name === "primes.next");
    if (next === undefined) {
      throw new Error("primes.next is not registered");
    }
    return await context.executeTool(next, { after: 97 });
  });

  expect(JSON.parse(answer)).toEqual({
    ok: true,
    value: { after: 97, prime: 101 },
  });
});
