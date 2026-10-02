import type { Material } from "../domain/schema";
const m = (
  id: string,
  name: string,
  en: string,
  aliases: string[],
  kind: Material["kind"] = "component",
  specs: Material["specs"] = {},
  unit: Material["unit"] = "ชิ้น",
  hint = "",
): Material => ({
  id,
  name,
  en,
  aliases: [en, ...aliases],
  kind,
  specs,
  unit,
  hint,
});
export const materials: Material[] = [
  m(
    "uno",
    "Arduino Uno R3",
    "Arduino Uno R3",
    ["arduino uno", "uno r3", "อาร์ดูโน่", "อาดูโน่"],
    "component",
    {
      model: {
        label: "รุ่นที่อ่านได้บนบอร์ด",
        options: ["UNO R3 ATmega328P", "other"],
      },
    },
    "ชิ้น",
    "รองรับ UNO R3 แบบ 5V เท่านั้น รุ่นอื่นยังไม่ถือว่าใช้แทนกันได้",
  ),
  m(
    "usb",
    "สาย USB สำหรับส่งข้อมูล",
    "USB data cable",
    ["สาย usb", "usb cable"],
    "component",
    {
      connector: {
        label: "หัวต่อฝั่งบอร์ด",
        options: ["USB-B", "USB-C", "Micro-USB"],
      },
      data: { label: "ส่งข้อมูลได้", options: ["yes", "no"] },
    },
    "เส้น",
  ),
  m(
    "computer",
    "คอมพิวเตอร์พร้อม Arduino IDE",
    "Computer",
    ["คอมพิวเตอร์", "laptop", "โน้ตบุ๊ก"],
    "tool",
    {
      ide: {
        label: "ติดตั้ง Arduino IDE และ Arduino AVR Boards",
        options: ["yes", "no"],
      },
    },
    "เครื่อง",
  ),
  m("breadboard", "เบรดบอร์ด", "Breadboard", ["เบรดบอร์ด", "บอร์ดทดลอง"]),
  m(
    "jumper",
    "สายจัมเปอร์",
    "Jumper wire",
    ["สายจัมเปอร์", "jumper", "สายไฟจัมเปอร์"],
    "component",
    {
      type: {
        label: "หัวต่อ",
        options: ["male-male", "male-female", "female-female"],
      },
    },
    "เส้น",
  ),
  m(
    "led",
    "LED ธรรมดา",
    "LED",
    ["หลอดแอลอีดี", "แอลอีดี"],
    "component",
    {
      type: {
        label: "ชนิด",
        options: ["discrete visible LED", "strip", "module"],
      },
    },
    "ชิ้น",
    "LED เดี่ยว 2 ขา ไม่ใช่แถบไฟหรือโมดูล",
  ),
  m(
    "resistor",
    "ตัวต้านทาน",
    "Resistor",
    ["ตัวต้านทาน", "resistance", "รีซิสเตอร์"],
    "component",
    { ohms: { label: "ความต้านทาน (Ω)", options: ["220", "330", "10000"] } },
    "ชิ้น",
    "อ่านรหัสหรือวัดค่าด้วยมิเตอร์ อย่าเดาจากภาพที่ไม่ชัด",
  ),
  m(
    "button",
    "ปุ่มกดชั่วขณะ",
    "Pushbutton",
    ["ปุ่มกด", "button", "สวิตช์กด"],
    "component",
    {
      type: {
        label: "ชนิดหน้าสัมผัส",
        options: ["normally-open momentary", "other"],
      },
    },
  ),
  m(
    "pot",
    "โพเทนชิโอมิเตอร์",
    "Potentiometer",
    ["potentiometer", "โพเทนชิโอมิเตอร์", "ตัวต้านทานปรับค่า"],
    "component",
    { ohms: { label: "ความต้านทาน (Ω)", options: ["10000", "other"] } },
  ),
  m(
    "piezo",
    "เพียโซแบบพาสซีฟ",
    "Passive piezo",
    ["passive buzzer", "piezo", "บัซเซอร์", "เพียโซ"],
    "component",
    {
      type: {
        label: "ชนิด",
        options: ["passive piezo", "active buzzer", "speaker"],
      },
    },
    "ชิ้น",
    "ลำโพงและบัซเซอร์แอ็กทีฟไม่เท่ากับเพียโซพาสซีฟ",
  ),
  m(
    "ldr",
    "ตัวต้านทานไวแสง",
    "Photoresistor",
    ["ldr", "photoresistor", "ตัวต้านทานไวแสง"],
    "component",
    { type: { label: "ชนิด", options: ["bare LDR", "module"] } },
  ),
  m(
    "cardboard",
    "กระดาษแข็ง",
    "Cardboard",
    ["กระดาษแข็ง", "กล่องกระดาษ"],
    "material",
    {},
    "แผ่น",
  ),
  m("paper", "กระดาษ", "Paper", ["กระดาษ"], "material", {}, "แผ่น"),
  m(
    "bottle",
    "ขวดสะอาด",
    "Clean bottle",
    ["ขวดน้ำ", "ขวดพลาสติก", "ขวด"],
    "material",
  ),
  m("stick", "ไม้ไอศกรีม", "Craft stick", ["ไม้ไอศกรีม"], "material"),
  m("string", "เชือก", "String", ["เชือก"], "material", {}, "เส้น"),
  m("rubber", "หนังยาง", "Rubber band", ["หนังยาง"], "material"),
  m("scissors", "กรรไกร", "Scissors", ["กรรไกร"], "tool"),
  m("tape", "เทปกาว", "Tape", ["เทปกาว"], "material"),
  m(
    "unknown",
    "ของอื่น / ยังระบุไม่ได้",
    "Unknown",
    ["unknown", "ไม่ทราบ"],
    "material",
    {},
    "ชิ้น",
    "เก็บไว้ในคลังได้ แต่ยังไม่ใช้ยืนยันความพร้อมของโปรเจกต์",
  ),
];
const paper = materials.find((m) => m.id === "paper")!;
paper.specs = {
  template: { label: "แบบบนกระดาษ", options: ["NASA Straw Rocket", "plain"] },
};
materials.push(
  m(
    "straw",
    "หลอดดื่มสะอาด",
    "Drinking straw",
    ["หลอด", "หลอดดูด"],
    "material",
  ),
  m("pencil", "ดินสอ", "Pencil", ["ดินสอ"], "tool"),
  m(
    "ruler",
    "ไม้เมตรหรือตลับเมตร",
    "Metric measuring tape",
    ["ไม้เมตร", "ตลับเมตร"],
    "tool",
    { metric: { label: "มีหน่วย cm หรือ m", options: ["yes", "no"] } },
  ),
);
export const materialById = Object.assign(
  Object.create(null),
  Object.fromEntries(materials.map((m) => [m.id, m])),
) as Record<string, Material>;
