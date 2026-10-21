import { materialById } from "../data/materials";
import type { InventoryItem } from "./schema";

export type InventoryFilters = {
  condition: "all" | InventoryItem["condition"];
  kind: "all" | "tool" | "material" | "component" | "custom";
  sort: "saved" | "name" | "quantity";
};
export function filterInventory(
  items: InventoryItem[],
  filters: InventoryFilters,
  language: string,
) {
  const result = items.filter(
    (item) =>
      (filters.condition === "all" || item.condition === filters.condition) &&
      (filters.kind === "all" ||
        (filters.kind === "custom"
          ? item.materialId === "unknown" || !materialById[item.materialId]
          : item.materialId !== "unknown" &&
            materialById[item.materialId]?.kind === filters.kind)),
  );
  if (filters.sort === "name")
    result.sort((a, b) => a.label.localeCompare(b.label, language));
  if (filters.sort === "quantity")
    result.sort((a, b) => b.quantity - a.quantity);
  return result;
}

// The expected value prevents a stale tab/dialog from subtracting from changed stock.
export function consumeInventory(
  items: InventoryItem[],
  id: string,
  quantity: number,
  expected: number,
): InventoryItem[] {
  const item = items.find((i) => i.id === id);
  if (
    !item ||
    item.quantity !== expected ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > item.quantity
  )
    throw Error("Inventory changed or quantity invalid");
  return items.flatMap((i) =>
    i.id !== id
      ? [i]
      : i.quantity === quantity
        ? []
        : [{ ...i, quantity: i.quantity - quantity }],
  );
}
