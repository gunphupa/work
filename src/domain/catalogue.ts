import { englishCopies, projects } from "../data/projects";
import { materialById, materials } from "../data/materials";
import type { InventoryItem, Project } from "./schema";
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().trim();
const words = (text: string) => normalize(text).split(/\s+/).filter(Boolean);
export const featuredIds = [
  "drawer-dividers",
  "bottle-planter",
  "tshirt-tote",
  "phone-stand",
  "cleaning-cloths",
  "moving-hand",
];
export function searchProjects(query: string, catalogue: Project[] = projects) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return catalogue.filter((p) => {
    const en = englishCopies[p.id];
    const haystack = [
      p.title,
      p.description,
      ...p.learning,
      en.title,
      en.description,
      ...en.learning,
      ...p.requirements.flatMap((r) =>
        r.choices.flatMap((c) => {
          const m = materialById[c.materialId];
          return m ? [m.name, m.en, ...m.aliases] : [];
        }),
      ),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
export function searchMaterials(query: string) {
  const terms = words(query);
  const exact = normalize(query);
  return materials
    .filter((m) =>
      terms.every((term) =>
        normalize([m.name, m.en, ...m.aliases].join(" ")).includes(term),
      ),
    )
    .sort(
      (a, b) =>
        Number(
          [b.name, b.en, ...b.aliases].some(
            (name) => normalize(name) === exact,
          ),
        ) -
        Number(
          [a.name, a.en, ...a.aliases].some(
            (name) => normalize(name) === exact,
          ),
        ),
    );
}
export function searchInventory(query: string, inventory: InventoryItem[]) {
  const terms = words(query);
  return inventory.filter((item) => {
    const material = materialById[item.materialId];
    const text = normalize(
      [
        item.label,
        item.notes,
        ...Object.values(item.specs),
        ...(material ? [material.name, material.en, ...material.aliases] : []),
      ].join(" "),
    );
    return terms.every((term) => text.includes(term));
  });
}
