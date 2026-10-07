import { expect, test } from "@playwright/test";

test("an agent in the page calls primes.next through WebMCP", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("footer")).toHaveText(
    "The capability catalog is registered as WebMCP tools."
  );

  const { names, answer } = await page.evaluate(async () => {
    const context = document.modelContext;
    if (context === undefined) {
      throw new Error("This browser exposes no model context");
    }
    const tools = await context.getTools();
    const next = tools.find((tool) => tool.name === "primes.next");
    if (next === undefined) {
      throw new Error("primes.next is not registered");
    }
    return {
      answer: await context.executeTool(next, JSON.stringify({ after: 97 })),
      names: tools.map((tool) => tool.name).toSorted(),
    };
  });

  expect(names).toEqual([
    "primes.check",
    "primes.history.clear",
    "primes.history.list",
    "primes.next",
  ]);
  expect(JSON.parse(answer)).toEqual({
    ok: true,
    value: { after: 97, prime: 101 },
  });
});
