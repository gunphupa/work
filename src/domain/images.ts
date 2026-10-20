export async function preparePhotos(
  files: File[],
  language: "th" | "en" = "th",
): Promise<{ mime: "image/webp"; data: string }[]> {
  const t = (th: string, en: string) => (language === "th" ? th : en);
  if (files.length > 5)
    throw new Error(
      t(
        "เลือกรูปได้สูงสุด 5 รูปต่อครั้ง",
        "Choose up to five photos at a time.",
      ),
    );
  const result = [];
  for (const file of files) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10_000_000
    )
      throw new Error(
        t(
          "ใช้ JPEG, PNG หรือ WebP ไม่เกิน 10 MB ต่อรูป",
          "Use JPEG, PNG or WebP files up to 10 MB each.",
        ),
      );
    const bmp = await createImageBitmap(file);
    try {
      if (bmp.width * bmp.height > 40_000_000)
        throw new Error(
          t(
            "รูปต้องไม่เกิน 40 ล้านพิกเซล",
            "Each photo must be no larger than 40 megapixels.",
          ),
        );
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error(
          t(
            "เบราว์เซอร์นี้แปลงรูปไม่ได้",
            "This browser could not process the photo.",
          ),
        );
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/webp", 0.85);
      if (!url.startsWith("data:image/webp;"))
        throw new Error(
          t(
            "เบราว์เซอร์นี้ไม่รองรับ WebP กรุณาเพิ่มของเอง",
            "This browser cannot create WebP images. Add your items manually.",
          ),
        );
      const data = url.split(",")[1];
      if (data.length > 2_666_664)
        throw new Error(
          t(
            "รูปหลังย่อยังใหญ่เกิน 2 MB โปรดครอปเฉพาะวัตถุ",
            "The resized photo exceeds 2 MB. Crop it closer to the object.",
          ),
        );
      result.push({ mime: "image/webp" as const, data });
    } finally {
      bmp.close();
    }
  }
  return result;
}

// A small, metadata-free image for this browser's inventory, never an AI upload.
export async function prepareItemPhoto(file: File, language: "th" | "en") {
  const t = (th: string, en: string) => (language === "th" ? th : en);
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10_000_000
  )
    throw Error(
      t(
        "ใช้ JPEG, PNG หรือ WebP ไม่เกิน 10 MB",
        "Use JPEG, PNG or WebP up to 10 MB.",
      ),
    );
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw Error(
        t("รูปต้องไม่เกิน 40 ล้านพิกเซล", "Use an image up to 40 megapixels."),
      );
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw Error(
        t(
          "อ่านรูปไม่ได้ ลองเลือกรูปใหม่",
          "Could not read the image. Try another photo.",
        ),
      );
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL("image/webp", 0.65);
    if (!photo.startsWith("data:image/webp;base64,") || photo.length > 60000)
      throw Error(
        t(
          "รูปยังใหญ่เกินไป โปรดครอปใกล้สิ่งของ",
          "The photo is too large. Crop closer to the item.",
        ),
      );
    return photo;
  } finally {
    bitmap.close();
  }
}
