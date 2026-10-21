import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
          notes: "private note",
          photo: "data:image/webp;base64,AA==",
        })),
      }),
    );
  }, webRequest.materials);
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { csrf: "web-fixture-csrf" } }),
  );
});

test("inventory group finds external tutorials with missing materials, sources and download", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/projects/search", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: webResult });
  });
  await page.goto("/#/inventory");
  await page
    .getByRole("link", { name: "Find projects on the web", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /scrap paper/ }),
  ).toBeChecked();
  await page
    .getByLabel("2. Other materials and your goal")
    .fill("Make a simple toy");
  await page
    .getByRole("button", { name: "Find projects on the web", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Paper spinner — test fixture" }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toEqual(webRequest);
  expect(JSON.stringify(requests)).not.toContain("private");
  await expect(
    page.getByText("Potential inventory match: scrap paper (3 sheet(s))"),
  ).toBeVisible();
  await expect(
    page.getByText("Not found in selected inventory", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open original tutorial" }),
  ).toHaveAttribute("href", "https://example.org/paper-spinner");
  await expect(
    page.getByRole("link", { name: "Synthetic video tutorial" }),
  ).toHaveAttribute("href", "https://example.org/spinner-video");
  await page
    .locator("summary")
    .filter({ hasText: "Possible substitutions" })
    .click();
  await expect(
    page.getByText("AI suggestion; no supporting source or physical test."),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download results" }).click();
  expect((await downloaded).suggestedFilename()).toBe(
    "rebuild-web-projects-2026-10-21.json",
  );
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

test("changing material group invalidates old results and new search uses chosen materials only", async ({
  page,
}) => {
  const sizes: number[] = [];
  await page.route("**/api/projects/search", (route) => {
    sizes.push(route.request().postDataJSON().materials.length);
    return route.fulfill({ json: webResult });
  });
  await page.goto("/#/web-projects");
  const search = page.getByRole("button", {
    name: "Find projects on the web",
    exact: true,
  });
  await search.click();
  await expect(
    page.getByRole("heading", { name: "Paper spinner — test fixture" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /tape/ }).uncheck();
  await expect(
    page.getByRole("heading", { name: "Paper spinner — test fixture" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Your materials or query changed.", { exact: false }),
  ).toBeVisible();
  await search.click();
  await expect(
    page.getByRole("heading", { name: "Paper spinner — test fixture" }),
  ).toBeVisible();
  expect(sizes).toEqual([2, 1]);
});

test("text-only materials work and unavailable/empty search preserves input without fake projects", async ({
  page,
}) => {
  await page.route("**/api/projects/search", (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
  await page.goto("/#/web-projects");
  await page.getByRole("button", { name: "Clear selection" }).click();
  const search = page.getByRole("button", {
    name: "Find projects on the web",
    exact: true,
  });
  await expect(search).toBeDisabled();
  const query = page.getByLabel("2. Other materials and your goal");
  await query.fill("Unlisted materials: paper, tape, pencil");
  await search.click();
  await expect(page.getByRole("alert")).toContainText(
    "Web search is not configured",
  );
  await expect(query).toHaveValue("Unlisted materials: paper, tape, pencil");
  await page.route("**/api/projects/search", (route) =>
    route.fulfill({ json: { ...webResult, projects: [], sources: [] } }),
  );
  await search.click();
  await expect(
    page.getByText("No projects had enough supporting source", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open original tutorial" }),
  ).toHaveCount(0);
});

test("pending requests lock selection and allow cancellation without stale results", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  await page.route("**/api/projects/search", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: webResult }).catch(() => {});
  });
  await page.goto("/#/web-projects");
  await page
    .getByRole("button", { name: "Find projects on the web", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /scrap paper/ }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("2. Other materials and your goal"),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Search cancelled.");
  release?.();
  await expect(
    page.getByRole("heading", { name: "Paper spinner — test fixture" }),
  ).toHaveCount(0);
});
