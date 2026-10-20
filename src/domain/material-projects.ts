import { materialById } from "../data/materials";
import { projects } from "../data/projects";
import { matchProject, type Match } from "./matching";
import type { InventoryItem, Project, Requirement } from "./schema";

export type MaterialProjectMatch = Match & {
  matchedMaterialIds: string[];
  relatedRequirements: Requirement[];
};

/**
 * Find authored guides that actually list one of the selected material types.
 * Identification is a discovery signal, not confirmation of condition or specs.
 * Preview items replace same-ID inventory entries instead of counting them twice.
 */
export function projectsForMaterials(
  items: InventoryItem[],
  inventory: InventoryItem[] = [],
  catalogue: Project[] = projects,
): MaterialProjectMatch[] {
  const focusedIds = new Set(
    items
      .map((item) => item.materialId)
      .filter((id) => id !== "unknown" && Object.hasOwn(materialById, id)),
  );
  if (!focusedIds.size) return [];
  const combined = new Map(inventory.map((item) => [item.id, item]));
  items.forEach((item) => combined.set(item.id, item));
  const available = [...combined.values()];
  return catalogue
    .flatMap((project): MaterialProjectMatch[] => {
      const relatedRequirements = project.requirements.filter((requirement) =>
        requirement.choices.some((choice) => focusedIds.has(choice.materialId)),
      );
      if (!relatedRequirements.length) return [];
      return [
        {
          ...matchProject(project, available),
          matchedMaterialIds: [
            ...new Set(
              relatedRequirements.flatMap((requirement) =>
                requirement.choices
                  .filter((choice) => focusedIds.has(choice.materialId))
                  .map((choice) => choice.materialId),
              ),
            ),
          ],
          relatedRequirements,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.matchedMaterialIds.length - a.matchedMaterialIds.length ||
        Number(b.relatedRequirements.some((r) => !r.optional)) -
          Number(a.relatedRequirements.some((r) => !r.optional)) ||
        b.fulfilled - a.fulfilled ||
        a.needed - b.needed ||
        a.project.minutes - b.project.minutes ||
        a.project.id.localeCompare(b.project.id),
    );
}
