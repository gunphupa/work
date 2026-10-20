import { describe, expect, it } from "vitest";
import { materialById } from "../src/data/materials";
import { projectById } from "../src/data/projects";
import { projectsForMaterials } from "../src/domain/material-projects";
import type { InventoryItem, Project } from "../src/domain/schema";
import { requestSchema, sanitizeAIAnswer } from "../server/ai";

function item(
  materialId: string,
  overrides: Partial<InventoryItem> = {},
): InventoryItem {
  return {
    id: `item-${materialId}`,
    materialId,
    label: materialById[materialId]?.name ?? "ของที่เพิ่มเอง",
    quantity: 1,
    unit: materialById[materialId]?.unit ?? "ชิ้น",
    condition: "unknown",
    verified: false,
    specs: {},
    notes: "",
    ...overrides,
  };
}

describe("photo-to-catalogue project discovery", () => {
  it("finds actual bottle guides with missing supplies while keeping photo candidates unchecked", () => {
    const bottle = item("bottle");
    const result = projectsForMaterials([bottle]).find(
      (match) => match.project.id === "bottle-planter",
    );
    expect(result).toBeDefined();
    expect(result!.matchedMaterialIds).toContain("bottle");
    expect(
      result!.relatedRequirements.some((r) =>
        r.choices.some((choice) => choice.materialId === "bottle"),
      ),
    ).toBe(true);
    expect(result!.requirements.some((r) => r.status === "missing")).toBe(true);
    expect(
      result!.requirements.find((r) =>
        r.requirement.choices.some((choice) => choice.materialId === "bottle"),
      )!.status,
    ).toBe("unknown");
    expect(result!.state).not.toBe("ready");
    expect(bottle.verified).toBe(false);
  });

  it("shows unknown board specifications and does not treat photo identification as readiness", () => {
    const result = projectsForMaterials([item("uno")]).find(
      (match) => match.project.id === "blink",
    )!;
    expect(result).toBeDefined();
    const board = result.requirements.find((r) =>
      r.requirement.choices.some((choice) => choice.materialId === "uno"),
    )!;
    expect(board.status).toBe("unknown");
    expect(board.requirement.choices[0].specs?.model).toContain(
      "UNO R3 ATmega328P",
    );
    expect(
      result.requirements.some(
        (r) =>
          r.status === "missing" &&
          r.requirement.choices.some(
            (choice) => choice.materialId === "computer",
          ),
      ),
    ).toBe(true);
  });

  it("does not invent guides for unidentified parts or a catalogue motor without coverage", () => {
    expect(
      projectsForMaterials([item("unknown", { label: "มอเตอร์ปริศนา" })]),
    ).toEqual([]);
    expect(projectsForMaterials([item("invented-id")])).toEqual([]);
    expect(projectsForMaterials([item("motor")])).toEqual([]);
  });

  it("does not count the same saved item twice when reopening its recommendations", () => {
    const twoBottles: Project = {
      ...projectById["bottle-planter"],
      requirements: [
        {
          id: "bottles",
          label: "Two bottles",
          quantity: 2,
          choices: [{ materialId: "bottle" }],
          why: "One bottle is not sufficient",
        },
      ],
    };
    const bottle = item("bottle", { verified: true, condition: "usable" });
    const result = projectsForMaterials([bottle], [bottle], [twoBottles])[0];
    expect(result.requirements[0].available).toBe(1);
    expect(result.requirements[0].status).toBe("short");
    expect(result.state).not.toBe("ready");
  });

  it("includes the rest of the owned inventory in missing-material checks", () => {
    const project = projectById.blink;
    const owned = project.requirements.map((requirement, index) =>
      item(requirement.choices[0].materialId, {
        id: `owned-${index}`,
        quantity: requirement.quantity,
        condition: "usable",
        verified: true,
        specs: Object.fromEntries(
          Object.entries(requirement.choices[0].specs ?? {}).map(
            ([key, values]) => [key, values[0]],
          ),
        ),
      }),
    );
    const board = owned.find((entry) => entry.materialId === "uno")!;
    expect(
      projectsForMaterials([board], owned).find(
        (match) => match.project.id === "blink",
      )!.state,
    ).toBe("ready");
  });
});

describe("AI candidate boundaries", () => {
  const candidate = {
    label: "ขวดพลาสติกเปล่า",
    materialId: "bottle",
    quantity: 2,
    specs: [],
    confidence: "ชัดเจน",
    evidence: "ผู้ใช้ระบุขวดเปล่า 2 ใบ",
    alternatives: [],
    questions: ["ขนาดเท่าไร?"],
  };
  it("preserves the user's object label instead of replacing it with a qualified catalogue name", () => {
    expect(
      sanitizeAIAnswer({ reply: "พบรายการ", candidates: [candidate] })
        .candidates[0],
    ).toEqual(candidate);
  });
  it("keeps an unlisted object as a custom item without inventing compatible specifications", () => {
    const result = sanitizeAIAnswer({
      reply: "ต้องตรวจเพิ่มเติม",
      candidates: [
        {
          ...candidate,
          label: "ชิ้นส่วนเครื่องพิมพ์",
          materialId: "printer-gear-new",
          specs: [{ key: "voltage", value: "5" }],
        },
      ],
    }).candidates[0];
    expect(result.label).toBe("ชิ้นส่วนเครื่องพิมพ์");
    expect(result.materialId).toBe("unknown");
    expect(result.specs).toEqual([]);
  });
  it("removes a guessed identity when the provider says it cannot identify the object", () => {
    const result = sanitizeAIAnswer({
      reply: "ขอรูปเพิ่มเติม",
      candidates: [
        {
          ...candidate,
          materialId: "uno",
          confidence: "ระบุไม่ได้",
          specs: [{ key: "model", value: "UNO R3 ATmega328P" }],
        },
      ],
    }).candidates[0];
    expect(result.materialId).toBe("unknown");
    expect(result.specs).toEqual([]);
  });
  it("accepts relevant observed spec values but drops unsupported keys and duplicates", () => {
    const result = sanitizeAIAnswer({
      reply: "อ่านฉลาก",
      candidates: [
        {
          ...candidate,
          materialId: "resistor",
          specs: [
            { key: "ohms", value: "4700" },
            { key: "condition", value: "usable" },
            { key: "ohms", value: "220" },
          ],
        },
      ],
    }).candidates[0];
    expect(result.specs).toEqual([{ key: "ohms", value: "4700" }]);
  });
  it("rejects blank labels rather than adding unusable inventory rows", () => {
    expect(() =>
      sanitizeAIAnswer({
        reply: "found",
        candidates: [{ ...candidate, label: "   " }],
      }),
    ).toThrow("Empty candidate label");
  });
  it("does not forward local inventory photos without explicit image upload consent", () => {
    const input = requestSchema.parse({
      mode: "help",
      text: "อธิบายขั้นตอน",
      inventory: [{ ...item("bottle"), photo: "data:image/webp;base64,AAAA" }],
    });
    expect(input.inventory[0]).not.toHaveProperty("photo");
    expect(input.images).toEqual([]);
  });
});
