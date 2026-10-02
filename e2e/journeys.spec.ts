import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("browse first and read every step with no inventory; save progress without a readiness gate", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ของที่มีในบ้าน ทำอะไรได้อีก?" }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "เลือกโปรเจกต์ที่อยากทำ" }).click();
  await page.getByRole("button", { name: "จัดบ้าน", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(5);
  await page
    .getByRole("link", { name: "ช่องแบ่งลิ้นชักจากกล่องเก่า", exact: true })
    .click();
  for (const name of [
    "วัดพื้นที่จริง",
    "ตัดแผ่นกั้นสองแนว",
    "บากร่องแล้วประกบ",
    "จัดของและลองเปิดปิด",
  ]) {
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    if (name !== "จัดของและลองเปิดปิด")
      await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  }
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rebuild.guest.v1")!).inventory,
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "บันทึกไว้ทำและจดความคืบหน้า" })
    .click();
  await page.getByRole("checkbox", { name: "ฉันทำขั้นตอนนี้แล้ว" }).check();
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await page.getByRole("checkbox", { name: "ฉันทำขั้นตอนนี้แล้ว" }).check();
  await page
    .getByRole("textbox", { name: "ปัญหา สิ่งที่ลอง" })
    .fill("บันทึกทดสอบ UI ไม่ใช่ผลทดลองจริง");
  await page.reload();
  await page.getByRole("button", { name: "ดูทุกขั้นตอน" }).click();
  await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(2);
  await expect(page.locator("input[type=checkbox]:disabled")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "ปัญหา สิ่งที่ลอง" }),
  ).toHaveValue("บันทึกทดสอบ UI ไม่ใช่ผลทดลองจริง");
  await page.screenshot({
    path: `docs/evidence/workspace-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("search household materials, edit quantities, export and restore a backup", async ({
  page,
}) => {
  await page.goto("/#/inventory");
  await page
    .getByRole("button", { name: "เพิ่มของที่มี", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "ค้นหาประเภทสิ่งของ" })
    .fill("t-shirt");
  await page.getByRole("button", { name: /เสื้อยืดเก่า Old T-shirt/ }).click();
  await page.getByRole("spinbutton", { name: "จำนวน", exact: true }).fill("2");
  await page.getByRole("button", { name: "บันทึกรายการ" }).click();
  await expect(page.locator(".inventory-row")).toContainText("2 ชิ้น");
  await page.getByRole("button", { name: "แก้ไข เสื้อยืดเก่า" }).click();
  await page.getByRole("spinbutton", { name: "จำนวน", exact: true }).fill("3");
  await page.getByRole("button", { name: "บันทึกรายการ" }).click();
  await page.reload();
  await expect(page.locator(".inventory-row")).toContainText("3 ชิ้น");
  await page.getByText("สำรองข้อมูลและจัดการคลัง", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("rebuild-backup.json");
  const contents = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(contents).inventory[0]).toMatchObject({
    materialId: "tshirt",
    quantity: 3,
    verified: true,
  });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ล้างข้อมูลทั้งหมด" }).click();
  await expect(page.locator(".inventory-row")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("ไฟล์นำเข้าคลัง").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
  await expect(page.locator(".inventory-row")).toContainText("3 ชิ้น");
});

test("bulk household suggestions stay unchecked and custom items remain possible", async ({
  page,
}) => {
  await page.goto("/#/inventory");
  await page.getByRole("button", { name: "พิมพ์หลายรายการ" }).click();
  await page
    .getByRole("textbox", { name: "รายการของที่มี" })
    .fill("Plastic bottles qty 2\nเสื้อยืด จำนวน 1\ncardboard tubes 3");
  await page.getByRole("button", { name: "แยกรายการจากข้อความ" }).click();
  await expect(page.locator(".candidate")).toHaveCount(3);
  await page
    .getByRole("button", { name: "เพิ่ม 3 รายการ", exact: true })
    .click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rebuild.guest.v1")!),
  );
  expect(
    state.inventory.map((i: { materialId: string }) => i.materialId),
  ).toEqual(["bottle", "tshirt", "tube"]);
  expect(state.inventory.every((i: { verified: boolean }) => !i.verified)).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "เพิ่มของที่มี", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "ค้นหาประเภทสิ่งของ" })
    .fill("วัสดุเฉพาะของฉัน");
  await page
    .getByRole("button", { name: "ไม่พบ? เพิ่มของอื่นด้วยชื่อของคุณเอง" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "ชื่อที่คุณเรียก" }),
  ).toHaveValue("วัสดุเฉพาะของฉัน");
  await page.getByRole("button", { name: "บันทึกรายการ" }).click();
  await expect(page.locator(".inventory-row")).toHaveCount(4);
});

test("Thai and English navigation, search and complete guides persist across refresh", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Everyday things. Made useful again." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "Find something to make" }).click();
  await page.getByRole("textbox", { name: "Search projects" }).fill("เสื้อยืด");
  await expect(page.locator(".project-card")).toHaveCount(3);
  await page.getByRole("textbox", { name: "Search projects" }).fill("drawer");
  await page
    .getByRole("link", { name: "Cardboard drawer dividers", exact: true })
    .click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(
    page.getByRole("heading", { name: "Cut two dividers" }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/guide-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "เปลี่ยนเป็นภาษาไทย" }).click();
  await expect(
    page.getByRole("heading", { name: "ตัดแผ่นกั้นสองแนว" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
});

test("optional inventory filters do not block guide access and material alternatives are visible", async ({
  page,
}) => {
  await page.goto("/#/explore");
  await page.getByText("ตัวกรองเพิ่ม", { exact: true }).click();
  await page.getByRole("checkbox", { name: "มีของที่ตรวจแล้วครบ" }).check();
  await expect(
    page.getByRole("heading", { name: "ยังไม่พบโปรเจกต์ที่ตรงเงื่อนไข" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await expect(page.locator(".project-card")).toHaveCount(12);
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "ดูโปรเจกต์เพิ่ม", exact: true })
      .click();
  await expect(page.locator(".project-card")).toHaveCount(37);
  await page.goto("/#/project/zipper-pull");
  await page
    .getByRole("button", { name: "ของที่ต้องใช้", exact: true })
    .click();
  await expect(page.locator(".alternative-note")).toContainText(
    "เชือกรองเท้า หรือ เชือก",
  );
  await page.locator(".item-options summary").first().click();
  await expect(
    page.getByRole("link", { name: "Shopee", exact: true }).first(),
  ).toHaveAttribute("href", /^https:\/\/shopee.co.th\/search\?keyword=/);
  await page.getByRole("button", { name: "เชือกรองเท้า", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "ชื่อที่คุณเรียก" }),
  ).toHaveValue("เชือกรองเท้า");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "อ่านขั้นตอนต่อ" }).click();
  await page.getByRole("button", { name: "ขั้นตอนถัดไป" }).click();
  await expect(
    page.getByRole("heading", { name: "สอดห่วงเชือก" }),
  ).toBeVisible();
});

test("tutorials distinguish a NASA video from searches, and Arduino wiring remains available", async ({
  page,
}) => {
  await page.goto("/#/project/straw-rocket");
  await page.getByRole("button", { name: "วิดีโอและแหล่งเรียนรู้" }).click();
  await expect(
    page.getByRole("link", { name: "เปิดวิดีโอ NASA" }),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=aTd2f59TSVo");
  await expect(
    page.getByRole("link", { name: "เปิดคู่มือต้นทางและภาพขั้นตอน" }),
  ).toHaveAttribute(
    "href",
    "https://www.jpl.nasa.gov/edu/resources/project/make-a-straw-rocket/",
  );
  await page.goto("/#/project/tshirt-tote");
  await page.getByRole("button", { name: "วิดีโอและแหล่งเรียนรู้" }).click();
  const href = await page
    .getByRole("link", { name: "ค้นหาคลิปภาษาอังกฤษ" })
    .getAttribute("href");
  expect(new URL(href!).searchParams.get("search_query")).toContain(
    "no sew t shirt tote bag",
  );
  await expect(
    page.getByText("คู่มือต้นฉบับของเรา", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/project/fade");
  await page.getByText("การต่อวงจรและโค้ด Arduino", { exact: true }).click();
  await expect(page.locator("pre")).toContainText("void setup()");
  await expect(page.locator(".wiring")).toContainText("D9");
});

test("unavailable AI, recovery of corrupt data and literal rendering of user input", async ({
  page,
}, testInfo) => {
  await page.goto("/#/inventory");
  await page.getByRole("button", { name: "เพิ่มจากรูปภาพ" }).click();
  await expect(
    page.getByRole("button", { name: "วิเคราะห์ภาพ" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "AI ยังไม่พร้อมใช้งาน เพิ่มรายการด้วยตนเองได้ และอ่านคู่มือได้ทุกขั้น",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/ai-unavailable-${testInfo.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "เพิ่มของที่มี", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ไม่พบ? เพิ่มของอื่นด้วยชื่อของคุณเอง" })
    .click();
  await page
    .getByRole("textbox", { name: "ชื่อที่คุณเรียก" })
    .fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "บันทึกรายการ" }).click();
  await expect(
    page.getByText("<img src=x onerror=alert(1)>", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".inventory-row img")).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem("rebuild.guest.v1", "invalid-data"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "อ่านข้อมูลที่บันทึกไว้ไม่ได้",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("rebuild.guest.v1")),
  ).toBe("invalid-data");
});

test("responsive navigation, keyboard access and no horizontal overflow", async ({
  page,
}) => {
  for (const lang of ["th", "en"]) {
    await page.goto("/");
    if (lang === "en")
      await page.getByRole("button", { name: "Switch to English" }).click();
    for (const route of [
      "/",
      "/inventory",
      "/explore",
      "/materials",
      "/about",
      "/project/calibrate",
      "/project/bottle-planter",
    ]) {
      await page.goto("/#" + route);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "My materials" })
    .click();
  await expect(
    page.getByRole("heading", { name: "My materials", exact: true }),
  ).toBeVisible();
});

test("legacy v1 build imports preserve records and allow later steps with unverified items", async ({
  page,
}) => {
  await page.goto("/#/inventory");
  const legacy = {
    version: 1,
    inventory: [
      {
        id: "old-led",
        materialId: "led",
        label: "Old LED",
        quantity: 1,
        unit: "ชิ้น",
        condition: "unknown",
        verified: false,
        specs: {},
        notes: "Old note",
      },
    ],
    builds: [
      {
        projectId: "fade",
        completed: [0],
        notes: "Previous build notes",
        measurements: [{ name: "Previous test", value: "2", unit: "s" }],
        substitutions: { "resistor-220": "330 ohm" },
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ],
  };
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("ไฟล์นำเข้าคลัง").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(page.locator(".inventory-row")).toContainText("Old LED");
  await page.goto("/#/build/fade");
  await expect(
    page.getByRole("textbox", { name: "ปัญหา สิ่งที่ลอง" }),
  ).toHaveValue("Previous build notes");
  await page.getByRole("checkbox", { name: "ฉันทำขั้นตอนนี้แล้ว" }).check();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rebuild.guest.v1")!),
  );
  expect(state.builds[0].completed).toEqual([0, 1]);
  expect(state.builds[0].measurements).toEqual(legacy.builds[0].measurements);
  expect(state.builds[0].substitutions).toEqual(legacy.builds[0].substitutions);
  expect(state.inventory).toEqual(legacy.inventory);
});
