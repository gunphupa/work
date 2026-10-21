import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";

const item = (id: string, materialId: string, label: string, quantity = 1) => ({
  id,
  materialId,
  label,
  quantity,
  unit: "ชิ้น",
  condition: "unknown",
  verified: false,
  specs: {},
  notes: "",
});

async function useEnglish(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("rebuild.language", "en"),
  );
}

async function photoFixture(page: Page, materialId: string, label: string) {
  await useEnglish(page);
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { ok: true, aiConfigured: true, catalogueVersion: 1 },
    }),
  );
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { csrf: "synthetic-photo-test" } }),
  );
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/ai", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        reply: "Synthetic UI fixture, not an actual image recognition result.",
        candidates: [
          {
            materialId,
            label,
            quantity: 1,
            specs: [],
            confidence: "ไม่แน่ใจ",
            evidence: "The label is not readable in this test fixture.",
            alternatives: [],
            questions: ["Please check the label and condition."],
          },
        ],
      },
    });
  });
  await page.goto("/#/inventory");
  await page.getByRole("button", { name: "Use a photo" }).click();
  const png = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#48634b" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Choose material photos").setInputFiles({
    name: "synthetic-ui-fixture.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("button", { name: "Analyse photos", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "I consent to sending" }).check();
  await page
    .getByRole("button", { name: "Analyse photos", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Item name", exact: true }),
  ).toHaveValue(label);
  return requests;
}

test("owned material search understands Thai, English aliases and custom names without changing saved data", async ({
  page,
}) => {
  const inventory = [
    item("nails", "nail", "ตะปูในกล่องแดง", 12),
    item("tape", "tape", "เทปใส"),
    item("custom", "unknown", "ไม้ค้ำต้นมะเขือ", 2),
  ];
  await page.addInitScript((inventory) => {
    localStorage.setItem(
      "rebuild.guest.v1",
      JSON.stringify({ version: 1, inventory, builds: [] }),
    );
  }, inventory);
  await page.goto("/#/inventory");
  const search = page.getByRole("textbox", {
    name: "ค้นหาของที่มี",
    exact: true,
  });
  await search.fill("nails");
  await expect(page.locator(".inventory-row")).toHaveCount(1);
  await expect(page.locator(".inventory-row")).toContainText("ตะปูในกล่องแดง");
  await search.fill("เทป");
  await expect(page.locator(".inventory-row")).toHaveCount(1);
  await expect(page.locator(".inventory-row")).toContainText("เทปใส");
  await search.fill("ต้นมะเขือ");
  await expect(page.locator(".inventory-row")).toHaveCount(1);
  await expect(page.locator(".inventory-row")).toContainText("ไม้ค้ำต้นมะเขือ");
  await search.fill("not-an-existing-material");
  await expect(page.locator(".inventory-row")).toHaveCount(0);
  await search.fill("");
  await expect(page.locator(".inventory-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page
    .getByRole("textbox", { name: "Search my materials", exact: true })
    .fill("ตะปู");
  await expect(page.locator(".inventory-row")).toHaveCount(1);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rebuild.guest.v1")!),
  );
  expect(saved.inventory).toEqual(inventory);
});

test("material picker searches nails and double-sided tape directly rather than scrolling", async ({
  page,
}) => {
  await useEnglish(page);
  await page.goto("/#/inventory");
  await page.getByRole("button", { name: "Add an item", exact: true }).click();
  const search = page.getByRole("textbox", { name: "Search material types" });
  await search.fill("ตะปู");
  await expect(page.locator(".material-picker button")).toHaveCount(1);
  await expect(page.locator(".material-picker")).toContainText("Nail");
  await search.fill("double-sided");
  await expect(page.locator(".material-picker button")).toHaveCount(1);
  await expect(page.locator(".material-picker")).toContainText("กาวสองหน้า");
  await page.locator(".material-picker button").click();
  await expect(
    page.getByRole("textbox", { name: "Your name for this item" }),
  ).toHaveValue(/Double-sided tape/i);
});

test("a custom material needs only its name and quantity and survives reload and backup restore", async ({
  page,
}) => {
  await useEnglish(page);
  let aiCalls = 0;
  await page.route("**/api/ai", (route) => {
    aiCalls++;
    return route.fulfill({
      status: 500,
      json: { error: "Unexpected AI call" },
    });
  });
  await page.goto("/#/inventory");
  await page
    .getByRole("button", { name: "Add a custom item", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your name for this item" })
    .fill("Unlisted reclaimed bracket");
  await page
    .getByRole("spinbutton", { name: "Quantity", exact: true })
    .fill("4");
  await expect(
    page.getByRole("combobox", { name: "Condition", exact: true }),
  ).toHaveValue("unknown");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page.locator(".inventory-row")).toContainText(
    "Unlisted reclaimed bracket",
  );
  await page.reload();
  await expect(page.locator(".inventory-row")).toContainText("4");
  await page
    .getByRole("button", { name: "Edit Unlisted reclaimed bracket" })
    .click();
  const png = await sharp({
    create: { width: 24, height: 24, channels: 3, background: "#48634b" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Item photo (optional)").setInputFiles({
    name: "custom-material.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("img", { name: "Selected item photo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await page.reload();
  await expect(page.locator(".inventory-row img")).toBeVisible();
  expect(aiCalls).toBe(0);
  await page.getByText("Backups & inventory settings", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const contents = await readFile((await download.path())!, "utf8");
  const saved = JSON.parse(contents);
  expect(saved.inventory[0]).toMatchObject({
    label: "Unlisted reclaimed bracket",
    materialId: "unknown",
    quantity: 4,
    condition: "unknown",
    specs: {},
    notes: "",
  });
  expect(saved.inventory[0].photo).toMatch(/^data:image\/webp;base64,/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear inventory & catalogue builds" }).click();
  await expect(page.locator(".inventory-row")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Inventory backup file").setInputFiles({
    name: "custom-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
  await expect(page.locator(".inventory-row")).toContainText(
    "Unlisted reclaimed bracket",
  );
  await expect(page.locator(".inventory-row img")).toBeVisible();
});

test("a photo identification can open an incomplete catalogue guide without approving specifications", async ({
  page,
}) => {
  const requests = await photoFixture(page, "uno", "Possibly an Arduino board");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    mode: "photo",
    language: "en",
    imageConsent: true,
  });
  await expect(
    page.getByRole("heading", { name: "Projects using these materials" }),
  ).toBeVisible();
  const blink = page.locator("dialog a[href='#/project/blink']");
  await expect(blink).toBeVisible();
  const project = page.locator(".material-project-card").filter({
    has: page.locator("a[href='#/project/blink']"),
  });
  await expect(project).toContainText("Missing / not enough");
  await expect(project).toContainText("Check before use");
  await expect(project).toContainText("UNO R3 ATmega328P");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rebuild.guest.v1")!).inventory,
    ),
  ).toEqual([]);
  const opened = page.waitForEvent("popup");
  await blink.click();
  const guide = await opened;
  await expect(guide).toHaveURL(/#\/project\/blink$/);
  await expect(
    guide.getByText("Every step is open, even with missing materials."),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(guide.locator(".step-card h3").first()).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Item name", exact: true }),
  ).toHaveValue("Possibly an Arduino board");
  await page
    .getByRole("combobox", { name: "Type for project matching" })
    .selectOption("unknown");
  await expect(page.locator("dialog a[href^='#/project/']")).toHaveCount(0);
  await expect(page.locator(".material-projects")).toContainText(
    "No catalogue guide matches the type of:",
  );
  expect(requests).toHaveLength(1);
});

test("an unrecognized photo object stays custom instead of being assigned an unrelated project", async ({
  page,
}) => {
  await photoFixture(page, "unknown", "Unidentified component");
  await expect(page.locator("dialog a[href^='#/project/']")).toHaveCount(0);
  await page.getByRole("button", { name: "Add 1 item", exact: true }).click();
  await expect(page.locator(".inventory-row")).toContainText(
    "Unidentified component",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rebuild.guest.v1")!),
  );
  expect(saved.inventory[0]).toMatchObject({
    materialId: "unknown",
    label: "Unidentified component",
    condition: "unknown",
    verified: false,
    specs: {},
  });
});

test("owned substitutes appear first with use conditions and never silently change inventory or readiness", async ({
  page,
}) => {
  await useEnglish(page);
  const inventory = [
    {
      ...item("my-tape", "double-sided-tape", "My double-sided tape"),
      condition: "usable",
      verified: true,
    },
  ];
  await page.addInitScript((inventory) => {
    localStorage.setItem(
      "rebuild.guest.v1",
      JSON.stringify({ version: 1, inventory, builds: [] }),
    );
  }, inventory);
  await page.goto("/#/project/jar-storage");
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page
    .getByText("Paper bonding: what can replace missing glue?", { exact: true })
    .click();
  const panel = page.locator(".paper-substitutions");
  await expect(panel.getByLabel("Missing item")).toHaveValue("glue-stick");
  const first = panel.locator(".substitution-card").first();
  await expect(first).toContainText("Double-sided tape");
  await expect(first.locator(".substitution-owned")).toHaveText(
    "In your inventory",
  );
  await expect(first).toContainText(
    "Not for waterproof sealing, electrical insulation or load-bearing joints.",
  );
  await expect(panel).toContainText("does not change project readiness");
  await panel.getByLabel("Missing item").selectOption("double-sided-tape");
  await expect(
    panel
      .locator(".substitution-card")
      .filter({ hasText: "My double-sided tape" }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rebuild.guest.v1")!),
  );
  expect(saved.inventory).toEqual(inventory);
  expect(saved.builds).toEqual([]);
  await page
    .getByRole("button", { name: "Read the steps", exact: true })
    .click();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.locator(".step-card h3").first()).toBeVisible();
});

test("saving an identified item and a build in separate tabs preserves both records", async ({
  page,
}) => {
  await photoFixture(page, "uno", "Board shared between tabs");
  const opened = page.waitForEvent("popup");
  await page.locator("dialog a[href='#/project/blink']").click();
  const guide = await opened;
  await expect(guide.locator("h1")).toBeVisible();
  await page.getByRole("button", { name: "Add 1 item", exact: true }).click();
  await expect(page.locator(".inventory-row")).toContainText(
    "Board shared between tabs",
  );
  // Change only the hash: the second tab must receive the storage event,
  // rather than re-read state through a full navigation or reload.
  await guide.evaluate(() => {
    location.hash = "/inventory";
  });
  await expect(guide.locator(".inventory-row")).toContainText(
    "Board shared between tabs",
  );
  await guide.evaluate(() => {
    location.hash = "/project/blink";
  });
  await guide
    .getByRole("button", { name: "Save a build & track progress" })
    .click();
  await expect(guide).toHaveURL(/#\/build\/blink$/);
  await page.reload();
  await expect(page.locator(".inventory-row")).toContainText(
    "Board shared between tabs",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rebuild.guest.v1")!),
  );
  expect(saved.inventory).toHaveLength(1);
  expect(saved.inventory[0]).toMatchObject({
    materialId: "uno",
    label: "Board shared between tabs",
    verified: false,
  });
  expect(saved.builds).toHaveLength(1);
  expect(saved.builds[0].projectId).toBe("blink");
});

test("a new photo analysis clears old suggestions and locks inputs until its response arrives", async ({
  page,
}) => {
  await photoFixture(page, "uno", "Old photo suggestion");
  let release = () => {};
  const waitForResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  let pendingRequests = 0;
  await page.route("**/api/ai", async (route) => {
    pendingRequests++;
    await waitForResponse;
    await route.fulfill({
      json: {
        reply: "Second synthetic result.",
        candidates: [
          {
            materialId: "unknown",
            label: "Fresh unknown suggestion",
            quantity: 1,
            specs: [],
            confidence: "ระบุไม่ได้",
            evidence: "Second UI fixture.",
            alternatives: [],
            questions: [],
          },
        ],
      },
    });
  });
  await page
    .getByRole("button", { name: "Analyse photos", exact: true })
    .click();
  try {
    await expect.poll(() => pendingRequests).toBe(1);
    await expect(page.locator(".candidate")).toHaveCount(0);
    await expect(page.locator("dialog a[href^='#/project/']")).toHaveCount(0);
    await expect(page.getByLabel("Choose material photos")).toBeDisabled();
    await expect(
      page.getByLabel("Material camera", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Take a photo" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("textbox", { name: "Extra details, such as a label" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: "I consent to sending" }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByRole("textbox", { name: "Item name", exact: true }),
  ).toHaveValue("Fresh unknown suggestion");
  await expect(page.getByLabel("Choose material photos")).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Extra details, such as a label" }),
  ).toBeEnabled();
  await expect(page.locator("dialog a[href^='#/project/']")).toHaveCount(0);
});

test("photo recommendations and substitution panels pass automated accessibility and viewport checks", async ({
  page,
}) => {
  const check = async () => {
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        targets: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  };
  await photoFixture(page, "uno", "Unverified board fixture");
  await check();
  await page.keyboard.press("Escape");
  await page.goto("/#/project/jar-storage");
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page
    .getByText("Paper bonding: what can replace missing glue?", { exact: true })
    .click();
  await page.locator(".substitution-options summary").first().click();
  await check();
});
