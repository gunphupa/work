import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { webRequest, webResult } from "../tests/web-fixtures";
const plan = {
  id: "external-plan-fixture",
  project: webResult.projects[0],
  sources: webResult.sources,
  request: webRequest,
  searchedAt: webResult.searchedAt,
  savedAt: webResult.searchedAt,
  updatedAt: webResult.searchedAt,
  completed: [],
  obtained: [],
  notes: "",
};
const backup = { format: "rebuild-external-plans", version: 1, plans: [plan] };
const key = "rebuild.external-plans.v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ backup, key }) => {
      localStorage.setItem("rebuild.language", "en");
      if (!sessionStorage.getItem("external-plan-fixture-seeded")) {
        localStorage.setItem(key, JSON.stringify(backup));
        sessionStorage.setItem("external-plan-fixture-seeded", "yes");
      }
    },
    { backup, key },
  );
});

test("saved external plans reopen with checklist, obtained supplies and automatic notes after reload", async ({
  page,
}) => {
  await page.goto("/#/builds");
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  await page.getByRole("checkbox", { name: /1\. Fold the paper/ }).check();
  await page.getByRole("checkbox", { name: /Pencil.*Prepared/ }).check();
  await page
    .getByLabel("My project notes", { exact: true })
    .fill("Fold tested with my scrap paper.");
  await expect(
    page.getByText("Notes saved automatically.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /1\. Fold the paper/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /Pencil.*Prepared/ }),
  ).toBeChecked();
  await expect(
    page.getByLabel("My project notes", { exact: true }),
  ).toHaveValue("Fold tested with my scrap paper.");
  await expect(
    page.getByRole("link", { name: "Open original tutorial", exact: true }),
  ).toHaveAttribute("href", "https://example.org/paper-spinner");
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
  await page.evaluate(() => document.body.classList.add("external-plan-print"));
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".external-plan-print-notes")).toHaveText(
    "Fold tested with my scrap paper.",
  );
  await expect(page.locator(".external-plan-print-notes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print plan" })).toBeHidden();
});

test("external plan backup export/import preserves progress and deletion requires confirmation", async ({
  page,
}) => {
  await page.goto("/#/builds");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export web plans" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "rebuild-external-plans.json",
  );
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  await page
    .getByLabel("My project notes", { exact: true })
    .fill("Keep my current notes");
  await page.getByLabel("Web plans backup file").setInputFiles({
    name: "plans.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByText("Added 0 plans. Existing plans and progress were kept."),
  ).toBeVisible();
  await expect(
    page.getByLabel("My project notes", { exact: true }),
  ).toHaveValue("Keep my current notes");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete this web plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Paper spinner — test fixture" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete this web plan" }).click();
  await expect(
    page.getByText("No web projects saved yet.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).plans.length,
      key,
    ),
  ).toBe(0);
});

test("a different tab updates saved plans and current checklists without losing notes", async ({
  page,
  context,
}) => {
  await page.goto("/#/builds");
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  const second = await context.newPage();
  await second.goto("/");
  await second.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.plans[0].notes = "Note from the other tab";
    state.plans[0].completed = [1];
    localStorage.setItem(key, JSON.stringify(state));
  }, key);
  await expect(
    page.getByLabel("My project notes", { exact: true }),
  ).toHaveValue("Note from the other tab");
  await expect(
    page.getByRole("checkbox", { name: /2\. Place the pencil/ }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: /1\. Fold the paper/ }).check();
  const persisted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).plans[0],
    key,
  );
  expect(persisted.notes).toBe("Note from the other tab");
  expect(persisted.completed.sort()).toEqual([0, 1]);
  await second.close();
});

test("corrupt stored external plans and unsafe imports are preserved without rendering unsafe links", async ({
  page,
}) => {
  await page.goto("/#/builds");
  const unsafe = structuredClone(backup);
  unsafe.plans[0].sources[0].url = "javascript:alert(1)";
  await page.getByLabel("Web plans backup file").setInputFiles({
    name: "unsafe.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(unsafe)),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Existing data is preserved",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).plans[0].sources[0].url,
      key,
    ),
  ).toBe("https://example.org/paper-spinner");
  await page.evaluate((key) => localStorage.setItem(key, "{corrupt"), key);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Existing data is preserved",
  );
  await page.getByLabel("Web plans backup file").setInputFiles({
    name: "plans.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    "{corrupt",
  );
});

test("editing a linked inventory item into a different material does not preserve its old match", async ({
  page,
}) => {
  await page.addInitScript((item) => {
    localStorage.setItem(
      "rebuild.guest.v1",
      JSON.stringify({
        version: 1,
        builds: [],
        inventory: [
          { ...item, label: "Steel pipe", verified: false, notes: "" },
        ],
      }),
    );
  }, webRequest.materials[0]);
  await page.goto("/#/builds");
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  await expect(
    page.getByText("Possible current inventory match:", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No unchanged linked item in your current inventory.", {
      exact: false,
    }),
  ).toHaveCount(2);
});

test("a failed note save retains the draft across in-app navigation and can be retried", async ({
  page,
}) => {
  await page.goto("/#/builds");
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key)
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, name, value);
    };
    window.addEventListener(
      "restore-plan-storage",
      () => {
        Storage.prototype.setItem = original;
      },
      { once: true },
    );
  }, key);
  await page
    .getByLabel("My project notes", { exact: true })
    .fill("Draft that must survive navigation");
  await expect(page.getByRole("alert")).toContainText("Could not save plans");
  await page.getByRole("link", { name: "My materials", exact: true }).click();
  await page.getByRole("link", { name: "Saved builds", exact: true }).click();
  await page
    .getByRole("button", { name: "Open plan · Paper spinner — test fixture" })
    .click();
  await expect(
    page.getByLabel("My project notes", { exact: true }),
  ).toHaveValue("Draft that must survive navigation");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("restore-plan-storage")),
  );
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).plans[0].notes,
      key,
    ),
  ).toBe("Draft that must survive navigation");
});
