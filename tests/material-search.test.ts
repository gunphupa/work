import { describe, expect, it } from "vitest";
import { searchInventory, searchMaterials } from "../src/domain/catalogue";
import {
  importState,
  mergeConfirmed,
  stateBytes,
} from "../src/domain/inventory";
import { itemSchema, type InventoryItem } from "../src/domain/schema";

const custom: InventoryItem = {
  id: "mine",
  materialId: "unknown",
  label: "ไม้ค้ำต้นมะเขือ",
  quantity: 2,
  unit: "ชิ้น",
  condition: "unknown",
  verified: false,
  specs: {},
  notes: "ยาว 30 cm",
};
const nail: InventoryItem = {
  ...custom,
  id: "nail-1",
  materialId: "nail",
  label: "ของในกล่องแดง",
  notes: "",
};
describe("material discovery and custom inventory", () => {
  it("finds the same catalogue type by Thai name, English and an alias", () => {
    for (const query of ["ตะปู", "NAIL", "ตะปูตอกไม้"])
      expect(searchMaterials(query)[0].id).toBe("nail");
    expect(searchMaterials("กาวสองหน้า")[0].id).toBe("double-sided-tape");
    expect(searchMaterials("glue stick")[0].id).toBe("glue-stick");
  });
  it("finds owned aliases, custom names and notes without changing inventory", () => {
    const inventory = [custom, nail];
    const before = structuredClone(inventory);
    expect(searchInventory("NAIL", inventory)).toEqual([nail]);
    expect(searchInventory("ตะปู", inventory)).toEqual([nail]);
    expect(searchInventory("ต้นมะเขือ 30", inventory)).toEqual([custom]);
    expect(searchInventory("  ", inventory)).toEqual(inventory);
    expect(searchInventory("ไม่มีสิ่งนี้", inventory)).toEqual([]);
    expect(inventory).toEqual(before);
  });
  it("keeps optional photo attachments on v1 export/import and does not merge distinct photos", () => {
    const first = { ...custom, photo: "data:image/webp;base64,UklGRg==" };
    const second = {
      ...custom,
      id: "other",
      photo: "data:image/webp;base64,UklGRw==",
    };
    const state = { version: 1, inventory: [first, second], builds: [] };
    expect(importState(JSON.stringify(state))).toEqual(state);
    expect(mergeConfirmed(state.inventory)).toHaveLength(2);
    expect(itemSchema.parse(custom).condition).toBe("unknown");
  });
  it("rejects blank names and executable/remote/oversized photo attachments", () => {
    expect(itemSchema.safeParse({ ...custom, label: "   " }).success).toBe(
      false,
    );
    for (const photo of [
      "https://example.com/tracking.jpg",
      "data:image/svg+xml;base64,AAAA",
      "javascript:alert(1)",
      `data:image/webp;base64,${"A".repeat(60000)}`,
    ])
      expect(itemSchema.safeParse({ ...custom, photo }).success).toBe(false);
  });
  it("counts UTF-8 bytes for Thai backups and rejects oversized imports consistently", () => {
    const state = { version: 1 as const, inventory: [custom], builds: [] };
    const raw = JSON.stringify(state);
    expect(stateBytes(state)).toBe(new TextEncoder().encode(raw).byteLength);
    expect(stateBytes(state)).toBeGreaterThan(raw.length);
    const oversized = JSON.stringify({ text: "ก".repeat(700000) });
    expect(oversized.length).toBeLessThan(2_000_000);
    expect(() => importState(oversized)).toThrow("2 MB");
  });
});
