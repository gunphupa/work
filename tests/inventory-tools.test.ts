import { describe, expect, it } from "vitest";
import {
  consumeInventory,
  filterInventory,
} from "../src/domain/inventory-tools";
import { importState, mergeConfirmed } from "../src/domain/inventory";
import { searchInventory } from "../src/domain/catalogue";
import { searchMaterialsPayload } from "../src/domain/web-projects";
import { requestSchema } from "../server/ai";
import type { InventoryItem } from "../src/domain/schema";
const item: InventoryItem = {
  id: "a",
  materialId: "unknown",
  label: "Sheet",
  quantity: 5,
  unit: "แผ่น",
  condition: "usable",
  verified: true,
  specs: {},
  notes: "private note",
  location: "drawer 3",
};
describe("inventory management", () => {
  it("filters and sorts copies while preserving stored order", () => {
    const items = [
      item,
      { ...item, id: "b", label: "Apple", condition: "damaged" as const },
    ];
    expect(
      filterInventory(
        items,
        { condition: "usable", kind: "custom", sort: "name" },
        "en",
      ),
    ).toEqual([item]);
    expect(
      filterInventory(
        items,
        { condition: "all", kind: "all", sort: "name" },
        "en",
      ).map((i) => i.id),
    ).toEqual(["b", "a"]);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("subtracts confirmed amounts without mutation and rejects stale or invalid quantities", () => {
    expect(consumeInventory([item], "a", 2, 5)[0].quantity).toBe(3);
    expect(item.quantity).toBe(5);
    expect(consumeInventory([item], "a", 5, 5)).toEqual([]);
    for (const qty of [0, -1, 6, 1.5])
      expect(() => consumeInventory([item], "a", qty, 5)).toThrow();
    expect(() => consumeInventory([item], "a", 1, 6)).toThrow();
    expect(() => consumeInventory([item], "missing", 1, 5)).toThrow();
  });
  it("preserves optional locations through backups but never sends them to AI", () => {
    const saved = importState(
      JSON.stringify({ version: 1, inventory: [item], builds: [] }),
    );
    expect(saved.inventory[0].location).toBe("drawer 3");
    expect(searchInventory("drawer", saved.inventory)).toHaveLength(1);
    expect(searchMaterialsPayload([item])[0]).not.toHaveProperty("location");
    expect(
      requestSchema.parse({ mode: "help", text: "question", inventory: [item] })
        .inventory[0],
    ).not.toHaveProperty("location");
    expect(
      mergeConfirmed([item, { ...item, id: "b", location: "drawer 4" }]),
    ).toHaveLength(2);
  });
});
