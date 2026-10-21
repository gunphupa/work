import { test, expect } from "@playwright/test";
import { webRequest, webResult } from "../tests/web-fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((materials) => {
    localStorage.setItem("rebuild.language", "en");
    localStorage.setItem(
      "rebuild.guest.v1",
      JSON.stringify({
        version: 1,
        builds: [],
        inventory: materials.map((m) => ({
          ...m,
          verified: false,
          notes: "private",
        })),
      }),
    );
  }, webRequest.materials);
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { csrf: "fixture" } }),
  );
  await page.route("**/api/ai/limits", (route) =>
    route.fulfill({
      json: {
        aiEnabled: true,
        webSearchEnabled: true,
        requestsRemaining: 5,
        webSearchRemaining: 4,
        resetsAt: "2026-10-22T00:00:00.000Z",
        currencyBudget: false,
      },
    }),
  );
});

test("preferences survive navigation, cached results explain reuse and save as reopenable plan", async ({
  page,
}) => {
  let request: Record<string, unknown> = {};
  await page.route("**/api/projects/search", (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({
      headers: {
        "X-Rebuild-Cache": "hit",
        "X-Rebuild-Cache-Expires": "2026-10-21T13:00:00.000Z",
      },
      json: webResult,
    });
  });
  await page.goto("/#/web-projects");
  await page
    .getByLabel("2. Other materials and your goal")
    .fill("Make a simple toy");
  await page
    .locator("summary")
    .filter({ hasText: "Search preferences" })
    .click();
  await page.getByLabel("Preferred difficulty").selectOption("beginner");
  await page.getByLabel("Available time (minutes)").fill("30");
  await page.getByLabel("Extra supply budget (THB)").fill("0");
  await page.getByLabel("Additional supplies").selectOption("avoid");
  await page.goto("/#/inventory");
  await page.goto("/#/web-projects");
  await expect(page.getByLabel("2. Other materials and your goal")).toHaveValue(
    "Make a simple toy",
  );
  await page
    .locator("summary")
    .filter({ hasText: "Search preferences" })
    .click();
  await expect(page.getByLabel("Available time (minutes)")).toHaveValue("30");
  await page
    .getByRole("button", { name: "Find projects on the web", exact: true })
    .click();
  await expect(
    page.getByText("Reused this session’s cached result", { exact: false }),
  ).toBeVisible();
  expect(request.preferences).toEqual({
    difficulty: "beginner",
    maxMinutes: 30,
    maxBudgetThb: 0,
    additionalSupplies: "avoid",
  });
  expect(JSON.stringify(request)).not.toContain("private");
  await page
    .getByRole("button", { name: "Save this project", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this browser. Reopen", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open saved builds", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Paper spinner — test fixture",
      exact: true,
    }),
  ).toBeVisible();
});

test("feedback is explicit and local; corrupt drafts stay preserved until reset", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("rebuild.web-search-draft.v1", "broken original"),
  );
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.route("**/api/projects/search", (route) =>
    route.fulfill({ json: webResult }),
  );
  await page.goto("/#/web-projects");
  await expect(
    page.getByText("The search draft could not be saved", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("rebuild.web-search-draft.v1"),
    ),
  ).toBe("broken original");
  await page.getByRole("button", { name: "Reset draft storage" }).click();
  await page
    .getByRole("button", { name: "Find projects on the web", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Paper spinner — test fixture" }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Give feedback on this result" })
    .click();
  await page.getByLabel("Feedback category").selectOption("materials_mismatch");
  await page.getByLabel("Optional details").fill("Need thicker paper.");
  await page
    .getByRole("button", { name: "Save feedback on this browser" })
    .click();
  await expect(
    page.getByText("Saved on this browser; not sent to the maintainer."),
  ).toBeVisible();
  const entries = await page.evaluate(
    () => JSON.parse(localStorage.getItem("rebuild.web-feedback.v1")!).entries,
  );
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    outcome: "materials_mismatch",
    note: "Need thicker paper.",
  });
  expect(posts).toHaveLength(1);
  // Feedback management remains available without another paid search.
  await page.goto("/#/inventory");
  await page.goto("/#/web-projects");
  await page
    .locator("summary")
    .filter({ hasText: "Manage feedback saved on this browser" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download feedback" }).click();
  expect((await download).suggestedFilename()).toBe(
    "rebuild-web-feedback.json",
  );
});
