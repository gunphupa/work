import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("main screens meet automated WCAG 2 AA checks", async ({ page }) => {
  const findings = [];
  for (const route of [
    "/",
    "/inventory",
    "/explore",
    "/project/fade",
    "/materials",
    "/about",
  ]) {
    await page.goto("/#" + route);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    findings.push(
      ...report.violations.map((v) => ({
        route,
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    );
  }
  expect(findings).toEqual([]);
});
