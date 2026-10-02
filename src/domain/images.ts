export async function preparePhotos(
  files: File[],
): Promise<{ mime: "image/webp"; data: string }[]> {
  if (files.length > 5) throw new Error("เลือกรูปได้สูงสุด 5 รูปต่อครั้ง");
  const result = [];
  for (const file of files) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10_000_000
    )
      throw new Error("ใช้ JPEG, PNG หรือ WebP ไม่เกิน 10 MB ต่อรูป");
    const bmp = await createImageBitmap(file);
    try {
      if (bmp.width * bmp.height > 40_000_000)
        throw new Error("รูปต้องไม่เกิน 40 ล้านพิกเซล");
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("เบราว์เซอร์นี้แปลงรูปไม่ได้");
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/webp", 0.85);
      if (!url.startsWith("data:image/webp;"))
        throw new Error("เบราว์เซอร์นี้ไม่รองรับ WebP กรุณาเพิ่มของเอง");
      const data = url.split(",")[1];
      if (data.length > 2_666_664)
        throw new Error("รูปหลังย่อยังใหญ่เกิน 2 MB โปรดครอปเฉพาะวัตถุ");
      result.push({ mime: "image/webp" as const, data });
    } finally {
      bmp.close();
    }
  }
  return result;
}
