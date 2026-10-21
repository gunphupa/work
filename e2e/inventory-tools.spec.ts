import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("custom units and private location survive reload; filtering and confirmed use update inventory", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("rebuild.language", "en"),
  );
  await page.goto("/#/inventory");
  await page
    .getByRole("button", { name: "Add a custom item", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Your name for this item")
    .fill("Workshop craft sheet");
  await dialog.getByLabel("Quantity", { exact: true }).fill("5");
  await dialog.getByLabel("Item unit").selectOption("แผ่น");
  await dialog.getByLabel("Storage location").fill("Top drawer");
  await dialog.getByRole("combobox", { name: "Condition", exact: true }).selectOption("usable");
  await dialog.getByRole("button", { name: "Save item", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Location: Top drawer", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filter condition").selectOption("damaged");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByLabel("Filter condition").selectOption("usable");
  await page.getByLabel("Filter type").selectOption("custom");
  await page.getByLabel("Search my materials").fill("drawer");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Record material use", exact: true })
    .click();
  await dialog.getByLabel("Quantity used").fill("2");
  await dialog
    .getByRole("button", { name: "Confirm material use", exact: true })
    .click();
  await expect(
    page.getByText("Remaining quantity updated.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("rebuild.guest.v1")!).inventory[0]
          .quantity,
    ),
  ).toBe(3);
  await expect(page.getByRole("article")).toContainText("3 sheet(s)");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
