import { materialById } from "../data/materials";
import type { InventoryItem, Project, Requirement } from "./schema";

type Copy = { th: string; en: string };
type Rule = {
  materialId: string;
  purpose: Copy;
  how: Copy;
  limits: Copy;
  source: "guide" | "conditional";
  specs?: Record<string, string[]>;
};
export type Substitution = Rule & {
  owned: InventoryItem[];
  needsCheck: boolean;
};
const copy = (th: string, en: string): Copy => ({ th, en });
const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");

function ownedCandidates(rule: Rule, inventory: InventoryItem[]) {
  const material = materialById[rule.materialId];
  const names = material
    ? [material.name, material.en, ...material.aliases].map(normalize)
    : [];
  return inventory.filter(
    (item) =>
      item.condition !== "damaged" &&
      (item.materialId === rule.materialId ||
        (item.materialId === "unknown" &&
          names.includes(normalize(item.label)))) &&
      Object.entries(rule.specs ?? {}).every(
        ([key, values]) => !item.specs[key] || values.includes(item.specs[key]),
      ),
  );
}
function prioritize(rules: Rule[], inventory: InventoryItem[]): Substitution[] {
  return rules
    .map((rule) => {
      const owned = ownedCandidates(rule, inventory);
      return {
        ...rule,
        owned,
        needsCheck: owned.some(
          (item) =>
            item.materialId === "unknown" ||
            !item.verified ||
            item.condition !== "usable" ||
            item.unit !== materialById[rule.materialId]?.unit ||
            Object.keys(rule.specs ?? {}).some((key) => !item.specs[key]),
        ),
      };
    })
    .sort((a, b) => Number(b.owned.length > 0) - Number(a.owned.length > 0));
}
function conditional(
  materialId: string,
  purpose: Copy,
  how: Copy,
  limits: Copy,
): Rule {
  return { materialId, purpose, how, limits, source: "conditional" };
}

/**
 * Suggestions describe a specific use; they never mutate inventory or readiness.
 * Electronics only expose alternatives already recorded in the guide.
 */
export function getSubstitutions(
  project: Project,
  requirement: Requirement,
  inventory: InventoryItem[],
): Substitution[] {
  const rules: Rule[] = requirement.choices.slice(1).map((choice) => ({
    materialId: choice.materialId,
    specs: choice.specs,
    source: "guide",
    purpose: copy(
      "ตัวเลือกที่คู่มือนี้ระบุไว้",
      "An alternative listed in this guide",
    ),
    how: copy(`ใช้สำหรับ: ${requirement.why}`, `Use for: ${requirement.why}`),
    limits: copy(
      "ตรวจจำนวน ขนาด สภาพ และสเปกตามรายการก่อนใช้ ไม่ได้ใช้แทนกันได้ในทุกงาน",
      "Check the required quantity, size, condition and specifications. This is not a universal replacement.",
    ),
  }));
  if (project.category === "electronics") return prioritize(rules, inventory);

  if (
    requirement.id === "cardboard" &&
    [
      "drawer-dividers",
      "desk-caddy",
      "phone-stand",
      "marble-maze",
      "moving-hand",
    ].includes(project.id)
  ) {
    rules.push(
      conditional(
        "box",
        copy("ใช้ผนังกล่องแทนแผ่นกระดาษแข็ง", "Use a box wall as cardboard"),
        copy(
          "คลี่กล่องแล้วเลือกส่วนเรียบที่ไม่มีรอยพับ ตัดตามขนาดในคู่มือ",
          "Flatten a box, select an uncreased panel, and cut it to the guide’s dimensions.",
        ),
        copy(
          "ตรวจให้เป็นกระดาษแข็งชนิดและความหนาที่คู่มือต้องการ แผ่นต้องใหญ่พอ แห้ง และไม่ยุบ หากทำขาตั้ง ให้จับโทรศัพท์ไว้ขณะทดสอบใกล้พื้น",
          "Match the cardboard type and thickness required by the guide. The panel must be large enough, dry and firm. For a phone stand, keep hold of the phone while testing near the floor.",
        ),
      ),
    );
  }
  if (
    requirement.id === "pencil" &&
    [
      "drawer-dividers",
      "desk-caddy",
      "phone-stand",
      "woven-coaster",
      "marble-maze",
      "moving-hand",
    ].includes(project.id)
  ) {
    rules.push(
      conditional(
        "marker",
        copy("ใช้ทำแนวตัดบนกระดาษ", "Mark cut lines on paper or cardboard"),
        copy(
          "ใช้ปลายปากกาขีดเส้นบาง ๆ ด้านที่จะซ่อนหรือด้านเศษ",
          "Draw a thin line on the hidden or waste side of the material.",
        ),
        copy(
          "หมึกลบไม่ได้และอาจซึม ทดสอบบนเศษก่อน ใช้แทนเฉพาะการทำเครื่องหมาย ไม่ใช้แทนดินสอที่เป็นแกนม้วนจรวด",
          "Ink may bleed and cannot be erased; test on a scrap. This replaces marking only, not a pencil used as a rocket-forming mandrel.",
        ),
      ),
    );
  }
  if (
    requirement.id === "marker" &&
    ["jar-storage", "cable-rolls", "cereal-gift-bag"].includes(project.id)
  ) {
    rules.push(
      conditional(
        "pencil",
        copy("เขียนป้ายกระดาษแห้ง", "Write a label on dry paper"),
        copy(
          "เขียนบนกระดาษไม่เคลือบให้เข้มพออ่านได้",
          "Write clearly on uncoated paper.",
        ),
        copy(
          "ไม่เหมาะกับการเขียนบนพลาสติก แก้ว หรือป้ายที่โดนน้ำ อ่านซ้ำว่าตัวหนังสือชัดก่อนติด",
          "Not suitable for writing directly on plastic, glass or wet labels. Check legibility before attaching.",
        ),
      ),
    );
  }
  if (requirement.id === "measuring-ruler") {
    rules.push({
      ...conditional(
        "ruler",
        copy("ใช้วัดระยะตามคู่มือ", "Measure the guide’s dimensions"),
        copy(
          "ใช้ไม้เมตรหรือตลับเมตรที่อ่านหน่วยเซนติเมตรได้ วัดจากจุดศูนย์",
          "Use a metre rule or measuring tape with centimetre markings and measure from zero.",
        ),
        copy(
          "ตลับเมตรโค้งได้ จึงไม่แทนขอบตรงสำหรับลากเส้น ต้องมีขอบตรงที่เหมาะสมแยกต่างหาก",
          "A flexible tape does not replace a straightedge for drawing lines; use a suitable straightedge separately.",
        ),
      ),
      specs: { metric: ["yes"] },
    });
  }
  if (requirement.id === "tshirt" && project.id === "cleaning-cloths") {
    rules.push(
      conditional(
        "fabric",
        copy("ตัดเป็นผ้าเช็ด", "Cut cleaning cloths"),
        copy(
          "เลือกเศษผ้านุ่ม ซับน้ำได้ และตัดเป็นชิ้นขนาดที่จับถนัด",
          "Choose soft, absorbent fabric scraps and cut them to a manageable size.",
        ),
        copy(
          "ซักให้สะอาดและลองว่าสีไม่ตกหรือทิ้งขุย ไม่ใช้ผ้าสกปรกสารเคมีหรือผิวหยาบกับพื้นผิวบอบบาง",
          "Wash first and test for colour transfer and lint. Avoid chemically contaminated or abrasive fabric on delicate surfaces.",
        ),
      ),
    );
  }
  if (requirement.id === "fabric" && project.id === "fabric-patch") {
    rules.push(
      conditional(
        "tshirt",
        copy("ตัดเป็นแผ่นปะผ้า", "Cut a fabric patch"),
        copy(
          "เลือกส่วนสะอาดที่ไม่บางหรือขาด ตัดให้ใหญ่กว่ารอยขาดตามคู่มือ",
          "Choose a clean, intact area and cut a patch larger than the tear as instructed.",
        ),
        copy(
          "ความยืดและความหนาควรใกล้ผ้าเดิม ไม่ใช้คำแนะนำนี้กับอุปกรณ์ป้องกันหรือของรับน้ำหนัก",
          "Match the original fabric’s stretch and thickness. This advice does not cover protective or load-bearing equipment.",
        ),
      ),
    );
  }
  if (project.id === "jar-storage" && requirement.id === "tape") {
    rules.push(
      conditional(
        "double-sided-tape",
        copy("ติดป้ายกระดาษด้านนอกโหล", "Attach a paper label outside the jar"),
        copy(
          "ติดเทปด้านหลังป้ายแล้วกดบนผิวโหลที่สะอาดและแห้ง",
          "Place tape behind the label and press it onto a clean, dry jar surface.",
        ),
        copy(
          "ใช้เฉพาะยึดป้าย ไม่ใช่ซ่อมรอยร้าวหรือยึดตัวโหล เทปไม่เคลือบกันน้ำให้ป้าย และอาจทิ้งคราบกาว",
          "For the label only, not cracked glass or securing the jar. It does not waterproof the label and may leave adhesive residue.",
        ),
      ),
    );
  }
  if (project.id === "cereal-gift-bag" && requirement.id === "tape") {
    rules.push(
      conditional(
        "double-sided-tape",
        copy(
          "ติดกระดาษหุ้มและฝาซ้อนของกล่องของขวัญเบา",
          "Attach wrapping and overlapping flaps on a light gift box",
        ),
        copy(
          "ติดเทปบนพื้นที่กระดาษที่ซ้อนกัน กดให้แนบ แล้วรองก้นกล่องขณะถือ",
          "Tape the overlapping paper surfaces, press firmly, and support the box from underneath.",
        ),
        copy(
          "ต้องมีพื้นที่ซ้อนกันพอ ไม่แทนเทปที่พาดปิดรอยต่อหรือเสริมก้นกล่อง ทดสอบการยึดก่อนใส่ของจริง",
          "Enough overlap is required. It does not replace tape bridging seams or reinforcing the base. Test the bond before adding the gift.",
        ),
      ),
    );
  }
  return prioritize(rules, inventory);
}

export const paperBondingMaterials = [
  "glue-stick",
  "glue",
  "double-sided-tape",
  "tape",
] as const;
export function getPaperBondingSubstitutions(
  missingMaterialId: string,
  inventory: InventoryItem[],
): Substitution[] {
  if (!paperBondingMaterials.some((id) => id === missingMaterialId)) return [];
  const purpose = copy(
    "ติดกระดาษกับกระดาษในงานแห้งและเบา",
    "Bond paper to paper for a dry, lightweight craft",
  );
  const rules = [
    conditional(
      "double-sided-tape",
      purpose,
      copy(
        "ติดเป็นแถบบางด้านหลังชิ้นกระดาษ ลอกแผ่นรอง แล้วกดให้แนบ",
        "Apply thin strips behind the paper, peel the backing and press together.",
      ),
      copy(
        "พื้นผิวต้องแห้ง มีส่วนซ้อนกัน ไม่ใช้แทนการปิดรอยต่อกันน้ำ ฉนวนไฟฟ้า หรือจุดรับน้ำหนัก ทดลองกับเศษก่อนเพราะแกะแล้วอาจฉีกกระดาษ",
        "Surfaces must be dry and overlap. Not for waterproof sealing, electrical insulation or load-bearing joints. Test on a scrap because removal may tear the paper.",
      ),
    ),
    conditional(
      "glue-stick",
      purpose,
      copy(
        "ทาบาง ๆ ให้ทั่วส่วนซ้อน กดแล้วรอให้แห้ง",
        "Apply a thin coat across the overlap, press and allow it to dry.",
      ),
      copy(
        "เหมาะกับกระดาษไม่เคลือบ ทดสอบกับกระดาษมันก่อน ไม่เหมาะกับงานเปียก ร้อน หรือรับน้ำหนัก",
        "Best for uncoated paper; test glossy paper first. Not for wet, hot or load-bearing applications.",
      ),
    ),
    conditional(
      "glue",
      purpose,
      copy(
        "เลือกกาว PVA สำหรับกระดาษ ทาบาง ๆ กดชิ้นงานให้ราบ และรอตามฉลาก",
        "Choose paper-safe PVA craft glue, apply sparingly, keep the pieces flat and follow the drying time on its label.",
      ),
      copy(
        "กาวเหลวอาจทำให้กระดาษย่น ชื่อ 'กาว' อย่างเดียวไม่ยืนยันชนิด ไม่แนะนำกาวร้อนหรือกาวช้างแทน",
        "Liquid glue can wrinkle paper. A generic 'glue' label does not confirm its type. This does not recommend hot glue or superglue.",
      ),
    ),
    conditional(
      "tape",
      purpose,
      copy(
        "ใช้เทปสำหรับกระดาษติดพาดรอยต่อด้านที่ยอมให้เห็นเทป",
        "Bridge the paper joint with paper-compatible tape on a side where visible tape is acceptable.",
      ),
      copy(
        "เห็นรอยเทปและอาจดึงผิวกระดาษลอก ทดสอบกับเศษก่อน ไม่เหมารวมเทปไฟฟ้าหรือเทปทุกชนิด",
        "Tape remains visible and may lift the paper surface. Test a scrap; this does not treat electrical tape or every tape type as equivalent.",
      ),
    ),
  ].filter((rule) => rule.materialId !== missingMaterialId);
  return prioritize(rules, inventory);
}
