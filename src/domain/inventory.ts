import { projectById } from "../data/projects";
import { materials, materialById } from "../data/materials";
import { stateSchema, type InventoryItem, type SavedState } from "./schema";
export const emptyState: SavedState = { version: 1, inventory: [], builds: [] };
export function parseInventory(text: string): InventoryItem[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((line) => {
      const lower = line.toLowerCase();
      const aliases = materials
        .flatMap((m) =>
          [m.name, ...m.aliases].map((a) => ({ m, a: a.toLowerCase() })),
        )
        .sort((a, b) => b.a.length - a.a.length);
      const m =
        aliases.find(({ a }) => {
          if (!/[a-z]/i.test(a)) return lower.includes(a);
          const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`(?<![a-z])${escaped}(?:s)?(?![a-z])`, "i").test(
            lower,
          );
        })?.m ?? materialById.unknown;
      const qty =
        line.match(/(?:จำนวน|qty)\s*[:=]?\s*(\d+)/i)?.[1] ??
        line.match(/^(\d+)\s*(?:x|×|ชิ้น|เส้น|แผ่น)\s*/i)?.[1] ??
        line.match(/(\d+)\s*(?:ชิ้น|เส้น|แผ่น|เครื่อง|ชุด)\s*$/)?.[1] ??
        line.match(/\s+(\d+)\s*$/)?.[1] ??
        "1";
      const specs: Record<string, string> = {};
      if (m.id === "resistor" || m.id === "pot") {
        const ohms = lower.match(/(\d+)\s*(k\s*)?(?:ohm|โอห์ม|ω)/);
        if (ohms) specs.ohms = String(Number(ohms[1]) * (ohms[2] ? 1000 : 1));
      }
      if (m.id === "uno" && /uno\s*r?3|uno r3/i.test(line))
        specs.model = "UNO R3 ATmega328P";
      return {
        id: crypto.randomUUID(),
        materialId: m.id,
        label: line.slice(0, 160),
        quantity: Math.min(10000, Math.max(1, Number(qty))),
        unit: m.unit,
        condition: "unknown",
        specs,
        verified: false,
        notes: "",
      };
    });
}
export function mergeConfirmed(items: InventoryItem[]): InventoryItem[] {
  const result: InventoryItem[] = [];
  for (const item of items) {
    const match = result.find(
      (x) =>
        x.materialId === item.materialId &&
        x.unit === item.unit &&
        x.condition === item.condition &&
        x.verified === item.verified &&
        JSON.stringify(Object.entries(x.specs).sort()) ===
          JSON.stringify(Object.entries(item.specs).sort()) &&
        x.label === item.label &&
        x.notes === item.notes,
    );
    if (match && match.quantity + item.quantity <= 10000)
      match.quantity += item.quantity;
    else result.push({ ...item });
  }
  return result;
}
export function importState(raw: string): SavedState {
  if (raw.length > 2_000_000) throw new Error("ไฟล์ใหญ่เกิน 2 MB");
  const state = stateSchema.parse(JSON.parse(raw));
  if (new Set(state.inventory.map((i) => i.id)).size !== state.inventory.length)
    throw new Error("รหัสรายการซ้ำ");
  if (
    new Set(state.builds.map((b) => b.projectId)).size !== state.builds.length
  )
    throw new Error("รหัสโปรเจกต์ซ้ำ");
  for (const build of state.builds) {
    const project = projectById[build.projectId];
    if (
      !project ||
      new Set(build.completed).size !== build.completed.length ||
      build.completed.some((i) => i >= project.steps.length)
    )
      throw new Error("ความคืบหน้าไม่ถูกต้อง");
  }
  return state;
}
export function downloadState(state: SavedState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rebuild-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
