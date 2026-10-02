import { test, expect } from "@playwright/test";
test("guest inventory, readiness, build notes and export survive refresh", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /ของเดิมที่คุณมี/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/#/inventory");
  await page.getByRole("button", { name: "พิมพ์หลายรายการ" }).click();
  await page
    .getByRole("textbox", { name: "รายการของที่มี" })
    .fill("LED จำนวน 2\nตัวต้านทาน 220 ohm จำนวน 3");
  await page.getByRole("button", { name: "แยกรายการจากข้อความ" }).click();
  await page.getByRole("button", { name: "เพิ่ม 2 รายการเพื่อยืนยัน" }).click();
  await expect(page.getByText("LED จำนวน 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("LED จำนวน 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "แก้ไข LED จำนวน 2" }).click();
  await page
    .getByRole("combobox", { name: "สภาพ", exact: true })
    .selectOption("usable");
  await page
    .getByRole("combobox", { name: "ชนิด", exact: true })
    .selectOption("discrete visible LED");
  await page.getByRole("checkbox", { name: "ฉันตรวจชนิด" }).check();
  await page.getByRole("button", { name: "บันทึกรายการ" }).click();
  await page.goto("/#/project/fade");
  await expect(
    page.getByText("ต้องตรวจสอบข้อมูลก่อน", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ลองด้วยคลังตัวอย่าง" }).click();
  await page.goto("/#/project/blink");
  await expect(
    page.getByText("พร้อมทำจากของที่ยืนยันแล้ว", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "บันทึกลงโต๊ะทำงาน" }).click();
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("textbox", { name: "ปัญหา สิ่งที่ลอง" })
    .fill("บันทึกทดสอบอัตโนมัติ ไม่ใช่ผลการทดลองจริง");
  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "ปัญหา สิ่งที่ลอง" }),
  ).toHaveValue("บันทึกทดสอบอัตโนมัติ ไม่ใช่ผลการทดลองจริง");
  await page.screenshot({
    path: `docs/evidence/workspace-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/#/inventory");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออก", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("rebuild-backup.json");
  await page.getByRole("button", { name: "นำเข้า", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("ไฟล์นำเข้าคลัง").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ version: 1, inventory: [], builds: [] }),
    ),
  });
  await expect(
    page.getByRole("heading", { name: "ทุกไอเดีย เริ่มจากของสักชิ้น" }),
  ).toBeVisible();
});
test("filters, unavailable photo AI, shopping, data recovery and safe rendering", async ({
  page,
}, testInfo) => {
  await page.goto("/#/explore");
  await page.getByRole("checkbox", { name: "ไม่หาของเพิ่ม" }).check();
  await expect(
    page.getByRole("heading", { name: "ยังไม่พบโปรเจกต์ที่ตรงเงื่อนไข" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await page
    .getByRole("textbox", { name: "ค้นหาโปรเจกต์ที่อยากทำ" })
    .fill("ไฟดวงแรก");
  await expect(
    page.getByRole("heading", { name: "ไฟดวงแรกของฉัน", exact: true }),
  ).toBeVisible();
  await page.goto("/#/project/fade");
  await page.getByRole("button", { name: "ของที่ต้องหาเพิ่ม" }).click();
  await expect(
    page.getByRole("link", { name: "ค้นหาสินค้านี้ · Shopee" }).first(),
  ).toHaveAttribute("href", /^https:\/\/shopee.co.th\/search\?keyword=/);
  await page.getByRole("button", { name: "คู่มือและโค้ด" }).click();
  await expect(page.locator("pre")).toContainText("void setup()");
  await page.screenshot({
    path: `docs/evidence/guide-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/#/inventory");
  await page.getByRole("button", { name: "เพิ่มจากรูปภาพ" }).click();
  await expect(
    page.getByRole("button", { name: "วิเคราะห์ภาพ" }),
  ).toBeDisabled();
  await expect(
    page.getByText("AI ยังไม่พร้อมใช้งาน คุณเพิ่มและยืนยันของด้วยตนเองได้"),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/ai-unavailable-${testInfo.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "เพิ่มของที่มี", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "ชื่อที่คุณเรียก" })
    .fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "บันทึกรายการ" }).click();
  await expect(
    page.getByText("<img src=x onerror=alert(1)>", { exact: true }),
  ).toBeVisible();
  expect(await page.locator(".inventory-row img").count()).toBe(0);
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
test("responsive navigation and no horizontal overflow", async ({ page }) => {
  for (const route of [
    "/",
    "/inventory",
    "/explore",
    "/materials",
    "/about",
    "/project/calibrate",
  ]) {
    await page.goto("/#" + route);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "ข้ามไปเนื้อหา" })).toBeFocused();
});

test("paper project shows craft instructions and no Arduino setup", async ({
  page,
}) => {
  await page.goto("/#/project/straw-rocket");
  await expect(
    page.getByRole("heading", { name: "จรวดกระดาษจากหลอดเดิม", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "คู่มือและโค้ด" }).click();
  await expect(
    page.getByRole("heading", { name: "เตรียมแบบและเริ่มสร้าง" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "โค้ด Arduino" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "อ่านคู่มือต้นทาง" }),
  ).toHaveAttribute(
    "href",
    "https://www.jpl.nasa.gov/edu/resources/project/make-a-straw-rocket/",
  );
});
