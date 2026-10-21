import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { webRequest, webResult } from "../tests/web-fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ request, result }) => {
      localStorage.setItem("rebuild.language", "en");
      localStorage.setItem(
        "rebuild.guest.v1",
        JSON.stringify({
          version: 1,
          builds: [],
          inventory: request.materials.map((item) => ({
            ...item,
            verified: false,
            notes: "PRIVATE INVENTORY NOTES",
            photo: "data:image/webp;base64,AA==",
          })),
        }),
      );
      localStorage.setItem(
        "rebuild.external-plans.v1",
        JSON.stringify({
          format: "rebuild-external-plans",
          version: 1,
          plans: [
            {
              id: "help-fixture",
              project: result.projects[0],
              sources: result.sources,
              request,
              searchedAt: result.searchedAt,
              savedAt: result.searchedAt,
              updatedAt: result.searchedAt,
              completed: [],
              obtained: [],
              notes: "PRIVATE PLAN NOTES",
            },
          ],
        }),
      );
    },
    { request: webRequest, result: webResult },
  );
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { csrf: "synthetic-help-csrf" } }),
  );
  await page.goto("/#/builds");
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "Ask AI about this project" })
    .click();
});

test("external help sends only question and displayed guide, leaves plans unchanged and renders plain text", async ({
  page,
}) => {
  let captured: Record<string, unknown> | undefined;
  const before = await page.evaluate(() => ({
    plans: localStorage.getItem("rebuild.external-plans.v1"),
    inventory: localStorage.getItem("rebuild.guest.v1"),
  }));
  await page.route("**/api/ai", (route) => {
    captured = route.request().postDataJSON();
    expect(route.request().headers()["x-csrf-token"]).toBe(
      "synthetic-help-csrf",
    );
    return route.fulfill({
      json: {
        reply:
          "<script>unsafe()</script> Follow the source diagram. https://invented.example/buy",
        candidates: [],
      },
    });
  });
  await page
    .getByLabel("Question about this project", { exact: true })
    .fill("Explain the first step");
  await page
    .getByRole("button", { name: "Ask about this plan", exact: true })
    .click();
  const explanation = page.getByRole("region", { name: "AI explanation" });
  await expect(explanation).toBeVisible();
  await expect(explanation).toContainText("<script>unsafe()</script>");
  await expect(explanation).not.toContainText("invented.example");
  expect(captured).toMatchObject({
    mode: "help",
    language: "en",
    text: "Explain the first step",
  });
  expect(captured).not.toHaveProperty("inventory");
  expect(captured).not.toHaveProperty("images");
  expect(JSON.stringify(captured)).not.toContain("PRIVATE");
  expect(JSON.stringify(captured)).not.toContain("inventoryIds");
  expect(
    await page.evaluate(() => ({
      plans: localStorage.getItem("rebuild.external-plans.v1"),
      inventory: localStorage.getItem("rebuild.guest.v1"),
    })),
  ).toEqual(before);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("external help cancels and reports unavailability without changing the plan", async ({
  page,
}) => {
  let calls = 0;
  let releaseFirst = () => {};
  const heldResponse = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markStarted = () => {};
  const firstStarted = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  await page.route("**/api/ai", async (route) => {
    calls++;
    if (calls === 1) {
      markStarted();
      await heldResponse;
      await route
        .fulfill({ json: { reply: "Late synthetic reply", candidates: [] } })
        .catch(() => {});
    } else
      await route.fulfill({ status: 503, json: { error: "No test provider" } });
  });
  await page
    .getByLabel("Question about this project", { exact: true })
    .fill("Explain this guide");
  await page
    .getByRole("button", { name: "Ask about this plan", exact: true })
    .click();
  await firstStarted;
  await expect(
    page.getByRole("textbox", {
      name: "Question about this project",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cancel question", exact: true })
    .click();
  releaseFirst();
  await expect(
    page.getByText("Question cancelled.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ask about this plan", exact: true })
    .click();
  await expect(
    page.getByText(
      "AI is unavailable. Your guide and saved plan remain available.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("My project notes", { exact: true }),
  ).toHaveValue("PRIVATE PLAN NOTES");
});
