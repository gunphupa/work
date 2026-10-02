import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("fixture-only photo proposal needs confirmation and failed requests preserve input", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { ok: true, aiConfigured: true, catalogueVersion: 1 },
    }),
  );
  let failed = true;
  await page.route("**/api/ai", (route) =>
    failed
      ? route.fulfill({
          status: 502,
          json: { error: "ข้อผิดพลาดจำลองสำหรับทดสอบ" },
        })
      : route.fulfill({
          json: {
            reply: "ข้อเสนอจำลองในชุดทดสอบ ไม่ใช่ผล AI จริง",
            candidates: [
              {
                label: "LED จาก fixture",
                materialId: "led",
                quantity: 1,
                specs: [],
                confidence: "ไม่แน่ใจ",
                evidence: "ภาพสังเคราะห์สำหรับทดสอบ UI",
                alternatives: ["unknown"],
                questions: ["ตรวจชนิด LED"],
              },
            ],
          },
        }),
  );
  await page.goto("/#/inventory");
  await page.getByRole("button", { name: "เพิ่มจากรูปภาพ" }).click();
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#2b5a3e" },
  })
    .png()
    .toBuffer();
  await page
    .locator("dialog input[type=file]")
    .setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: png });
  await page
    .getByRole("textbox", { name: "ข้อมูลเพิ่ม เช่น ชื่อบนฉลาก" })
    .fill("ข้อมูล fixture ที่ต้องอยู่หลังข้อผิดพลาด");
  await page.getByRole("checkbox", { name: "ยินยอมส่งรูป" }).check();
  await page.getByRole("button", { name: "วิเคราะห์ภาพ" }).click();
  await expect(page.getByRole("alert")).toContainText("ข้อผิดพลาดจำลอง");
  await expect(
    page.getByRole("textbox", { name: "ข้อมูลเพิ่ม เช่น ชื่อบนฉลาก" }),
  ).toHaveValue("ข้อมูล fixture ที่ต้องอยู่หลังข้อผิดพลาด");
  failed = false;
  await page.getByRole("button", { name: "วิเคราะห์ภาพ" }).click();
  await expect(
    page.getByText("LED จาก fixture", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "เพิ่ม 1 รายการเพื่อยืนยัน" }).click();
  await expect(
    page.getByText("รอยืนยันชนิดและสเปก", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "แก้ไข LED จาก fixture" }).click();
  await expect(
    page.getByRole("checkbox", { name: "ฉันตรวจชนิด" }),
  ).not.toBeChecked();
});
