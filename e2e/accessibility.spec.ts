import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const language of ["th", "en"]) {
  test(`${language} main screens and guide sections meet automated WCAG 2 AA checks`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    if (language === "en")
      await page.getByRole("button", { name: "Switch to English" }).click();
    const findings: unknown[] = [];
    async function check(screen: string) {
      await page.evaluate(() => document.fonts.ready);
      const report = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      findings.push(
        ...report.violations.map((v) => ({
          screen,
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      );
    }
    for (const route of [
      "/",
      "/inventory",
      "/explore",
      "/project/fade",
      "/materials",
      "/about",
      "/project/bottle-planter",
    ]) {
      await page.goto("/#" + route);
      await expect(page.locator("h1").first()).toBeVisible();
      await check(route);
    }
    await page
      .getByRole("button", {
        name: language === "en" ? "Materials" : "ของที่ต้องใช้",
        exact: true,
      })
      .click();
    await check("guide-materials");
    await page
      .getByRole("button", {
        name: language === "en" ? "Videos & sources" : "วิดีโอและแหล่งเรียนรู้",
        exact: true,
      })
      .click();
    await check("guide-tutorials");
    await page.goto("/#/inventory");
    await page
      .getByRole("button", {
        name: language === "en" ? "Add an item" : "เพิ่มของที่มี",
        exact: true,
      })
      .click();
    await check("material-picker");
    await page
      .getByRole("textbox", {
        name:
          language === "en" ? "Search material types" : "ค้นหาประเภทสิ่งของ",
      })
      .fill("t-shirt");
    await page.locator(".material-picker button").first().click();
    await check("item-editor");
    expect(findings).toEqual([]);
  });
}
