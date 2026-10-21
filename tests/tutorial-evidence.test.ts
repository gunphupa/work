import { describe, expect, it } from "vitest";
import {
  assembleTutorialCards,
  retrievedTutorials,
  sourceExtractionInstructions,
  type RetrievedTutorial,
} from "../server/tutorial-evidence";
import { webRequest, webResult } from "./web-fixtures";

// Controlled synthetic evidence tests the boundary, not factual page extraction.
const tutorial: RetrievedTutorial = {
  sourceId: "s1",
  sourceUrl: webResult.sources[0].url,
  title: "Written paper activity",
  description: "A folded paper activity.",
  materials: [
    {
      name: "Paper",
      amount: "unknown",
      listedAs: "required",
      sourceExcerpt: "Paper",
    },
    {
      name: "Pencil",
      amount: "1",
      listedAs: "optional",
      sourceExcerpt: "1 pencil (optional)",
    },
  ],
  steps: [{ text: "Fold the paper.", sourceExcerpt: "Fold the paper." }],
  sourceTime: "30–60 minutes",
  sourceDifficulty: "unknown",
  sourceCost: "unknown",
};
const fitted = {
  sourceId: "s1",
  fit: "Paper may fit; check its size.",
  materialMatches: [
    { materialIndex: 0, inventoryIds: ["paper-1"], check: "Check thickness." },
  ],
  substitutions: [],
  cautions: [],
  videoSourceIds: [],
  shoppingSourceIds: [],
};
describe("source extraction and inventory fitting separation", () => {
  it("matches tracking variants of the opened page without collapsing meaningful query parameters", () => {
    const tracked = {
      ...tutorial,
      sourceUrl: tutorial.sourceUrl + "?utm_source=openai",
    };
    expect(
      retrievedTutorials(
        JSON.stringify({ tutorials: [tracked] }),
        webResult.sources,
        ["s1"],
      ),
    ).toHaveLength(1);
    const other = {
      ...tutorial,
      sourceUrl: tutorial.sourceUrl + "?article=another",
    };
    expect(
      retrievedTutorials(
        JSON.stringify({ tutorials: [other] }),
        webResult.sources,
        ["s1"],
      ),
    ).toEqual([]);
  });
  it("prevents formatting from introducing or replacing sourced facts with general DIY advice", () => {
    const result = assembleTutorialCards(
      {
        projects: [
          {
            ...fitted,
            title: "Invented adaptation",
            summary: "Source says to add a metal stabilizer",
            materials: [
              { name: "Metal stabilizer", amount: "2", sourceIds: ["s1"] },
            ],
            steps: [
              {
                text: "Attach adhesive to the new stabilizer.",
                sourceIds: ["s1"],
              },
            ],
            materialMatches: [
              ...fitted.materialMatches,
              {
                materialIndex: 19,
                inventoryIds: ["tape-1"],
                check: "Extra repair material",
              },
            ],
          },
        ],
      },
      [tutorial],
      webRequest,
    );
    const project = result.projects[0];
    expect(project.title).toBe(tutorial.title);
    expect(project.summary).toBe(tutorial.description);
    expect(project.materials.map((m) => [m.name, m.amount])).toEqual([
      ["Paper", "unknown"],
      ["Pencil", "1"],
    ]);
    expect(project.steps).toEqual([
      { text: "Fold the paper.", sourceIds: ["s1"] },
    ]);
    expect(JSON.stringify(project)).not.toContain("stabilizer");
    expect(project.materials[1].note).toContain("Optional in the source");
  });
  it("keeps missing/ambiguous matches missing and generated adaptations explicitly unsourced", () => {
    const result = assembleTutorialCards(
      {
        projects: [
          {
            ...fitted,
            materialMatches: [
              fitted.materialMatches[0],
              fitted.materialMatches[0],
            ],
            substitutions: [
              {
                missing: "Pencil",
                alternative: "Crayon",
                conditions: "Untested suggestion",
                inventoryIds: [],
                sourceIds: ["s1"],
              },
            ],
          },
        ],
      },
      [tutorial],
      webRequest,
    );
    expect(
      result.projects[0].materials.every((m) => m.inventoryIds.length === 0),
    ).toBe(true);
    expect(result.projects[0].substitutions[0].sourceIds).toEqual([]);
  });
  it("requires valid structured extraction and preserves source stated time rather than request time", () => {
    expect(() =>
      retrievedTutorials(
        "General tips, extra supplies, and followup questions",
        webResult.sources,
        ["s1"],
      ),
    ).toThrow();
    const selected = retrievedTutorials(
      JSON.stringify({ tutorials: [tutorial] }),
      webResult.sources,
      ["s1"],
    );
    expect(selected[0].sourceTime).toBe("30–60 minutes");
    expect(sourceExtractionInstructions).toContain(
      "NEVER to modify its contents",
    );
    expect(sourceExtractionInstructions).toContain(
      "actual Materials / Supplies / Tools section",
    );
    expect(sourceExtractionInstructions).toContain(
      "does not support any particular alternative",
    );
  });
});
