import { describe, expect, it } from "vitest";
import { materialById } from "../src/data/materials";
import { projectById } from "../src/data/projects";
import { matchProject } from "../src/domain/matching";
import {
  getPaperBondingSubstitutions,
  getSubstitutions,
} from "../src/domain/substitutions";
import type { InventoryItem } from "../src/domain/schema";

function item(
  materialId: string,
  changes: Partial<InventoryItem> = {},
): InventoryItem {
  return {
    id: `test-${materialId}`,
    materialId,
    label: materialById[materialId]?.name ?? materialId,
    quantity: 1,
    unit: materialById[materialId]?.unit ?? "ชิ้น",
    verified: true,
    condition: "usable",
    specs: {},
    notes: "",
    ...changes,
  };
}
function suggestions(
  projectId: string,
  requirementId: string,
  inventory: InventoryItem[] = [],
) {
  const project = projectById[projectId];
  return getSubstitutions(
    project,
    project.requirements.find((r) => r.id === requirementId)!,
    inventory,
  );
}
describe("contextual substitutions", () => {
  it("prioritizes an owned paper adhesive without treating it as confirmed compatible", () => {
    const inventory = [
      item("double-sided-tape", { condition: "unknown", verified: false }),
    ];
    const result = getPaperBondingSubstitutions("glue-stick", inventory);
    expect(result[0].materialId).toBe("double-sided-tape");
    expect(result[0].owned).toHaveLength(1);
    expect(result[0].needsCheck).toBe(true);
    expect(result[0].limits.en).toContain("electrical insulation");
    expect(result.some((r) => r.materialId === "glue-stick")).toBe(false);
  });
  it("prioritizes any owned alternative, not a hard-coded product order", () => {
    const result = getPaperBondingSubstitutions("glue-stick", [item("glue")]);
    expect(result[0].materialId).toBe("glue");
  });
  it("can recognize exact custom names while requiring a check", () => {
    const result = getPaperBondingSubstitutions("glue-stick", [
      item("unknown", { label: "  double-sided tape  " }),
    ]);
    const tape = result.find((r) => r.materialId === "double-sided-tape")!;
    expect(tape.owned).toHaveLength(1);
    expect(tape.needsCheck).toBe(true);
  });
  it("does not claim arbitrary similarly named or damaged items are available", () => {
    const result = getPaperBondingSubstitutions("glue-stick", [
      item("double-sided-tape", { condition: "damaged" }),
      item("unknown", { label: "not double-sided tape" }),
    ]);
    expect(
      result.find((r) => r.materialId === "double-sided-tape")?.owned,
    ).toHaveLength(0);
  });
  it("offers double-sided tape for jar labels but not for a phone support, planter edge or lint roller", () => {
    expect(
      suggestions("jar-storage", "tape").map((r) => r.materialId),
    ).toContain("double-sided-tape");
    for (const id of ["phone-stand", "bottle-planter", "lint-roller"])
      expect(suggestions(id, "tape").map((r) => r.materialId)).not.toContain(
        "double-sided-tape",
      );
  });
  it("preserves explicit guide alternatives and puts owned ones first", () => {
    const result = suggestions("zipper-pull", "shoelace", [item("string")]);
    expect(result[0].materialId).toBe("string");
    expect(result[0].source).toBe("guide");
    expect(result[0].owned).toHaveLength(1);
  });
  it("does not substitute a marking pen for the pencil used to roll a rocket", () => {
    expect(
      suggestions("drawer-dividers", "pencil").map((r) => r.materialId),
    ).toContain("marker");
    expect(suggestions("straw-rocket", "pencil")).toEqual([]);
  });
  it("rejects explicit wrong metric specifications and asks for missing specifications", () => {
    const wrong = suggestions("drawer-dividers", "measuring-ruler", [
      item("ruler", { specs: { metric: "no" } }),
    ]);
    expect(wrong[0].owned).toHaveLength(0);
    const unknown = suggestions("drawer-dividers", "measuring-ruler", [
      item("ruler"),
    ]);
    expect(unknown[0].owned).toHaveLength(1);
    expect(unknown[0].needsCheck).toBe(true);
    expect(unknown[0].limits.en).toContain("straightedge");
  });
  it("does not infer electronic replacements or change matching readiness", () => {
    const project = projectById.blink;
    for (const requirement of project.requirements)
      expect(
        getSubstitutions(project, requirement, [
          item("unknown", { label: "similar Arduino" }),
        ]),
      ).toEqual([]);
    const inventory = [item("double-sided-tape")];
    const before = matchProject(projectById["jar-storage"], inventory);
    suggestions("jar-storage", "tape", inventory);
    expect(matchProject(projectById["jar-storage"], inventory)).toEqual(before);
    expect(
      before.requirements.find((r) => r.requirement.id === "tape")?.status,
    ).toBe("missing");
  });
  it("returns no advice for an unsupported generic bonding material", () => {
    expect(getPaperBondingSubstitutions("unknown", [])).toEqual([]);
  });
});
