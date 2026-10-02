import { englishCopies, projects } from "../data/projects";
import { materialById, materials } from "../data/materials";
import type { Project } from "./schema";
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
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return materials.filter((m) =>
    terms.every((term) =>
      [m.name, m.en, ...m.aliases].join(" ").toLowerCase().includes(term),
    ),
  );
}
