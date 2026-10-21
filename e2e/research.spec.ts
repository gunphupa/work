import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("rebuild.language", "en"),
  );
});
test("consent, navigation-safe stopped timer, actual observation export and withdrawal", async ({
  page,
}) => {
  await page.goto("/#/research");
  await expect(
    page.getByRole("heading", { name: "Research task recorder" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("rebuild.research.v1")),
  ).toBeNull();
  await expect(
    page.getByRole("button", { name: "Consent and start recording" }),
  ).toBeDisabled();
  await page.getByLabel("Researcher-assigned code, e.g. P01").fill("P20");
  await page.getByLabel("Study stage").selectOption("main");
  await page
    .getByRole("checkbox", { name: /I understand and consent/ })
    .check();
  await page
    .getByRole("button", { name: "Consent and start recording" })
    .click();
  await page
    .getByRole("button", { name: "Start task timer", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Observed outcome", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Find a project", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Research recording status" }),
  ).toContainText("P20");
  await page.getByRole("link", { name: "Return to task recorder" }).click();
  await page
    .getByRole("button", { name: "Stop task timer", exact: true })
    .click();
  const frozen = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("rebuild.research.v1")!).sessions[0]
        .running.elapsedMs,
  );
  await page
    .getByRole("combobox", { name: "Observed outcome", exact: true })
    .selectOption("failure");
  await page.getByLabel("Help received (count)").fill("1");
  await page.getByLabel("Observed errors (count)").fill("2");
  await page
    .getByLabel("Observation / supporting evidence (no personal data)")
    .fill("Synthetic browser test: could not explain source.");
  await page
    .getByRole("button", { name: "Save task outcome", exact: true })
    .click();
  const recorded = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("rebuild.research.v1")!).sessions[0]
        .observations[0],
  );
  expect(recorded.elapsedMs).toBe(frozen);
  expect(recorded).toMatchObject({
    outcome: "failure",
    assistance: 1,
    errors: 2,
  });
  await page
    .getByRole("button", {
      name: "End session and stop recording",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Research recording status" }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^rebuild-research-.*\.csv$/,
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
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Delete all local research data",
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("rebuild.research.v1")),
  ).toBeNull();
});
test("preserves malformed research data and offers explicit recovery without starting recording", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("rebuild.research.v1", "existing-invalid-data"),
  );
  await page.goto("/#/research");
  await expect(
    page.getByRole("button", { name: "Download original data", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("rebuild.research.v1")),
  ).toBe("existing-invalid-data");
  await expect(
    page.getByRole("button", { name: "Consent and start recording" }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download original data", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "rebuild-research-recovery.json",
  );
});
