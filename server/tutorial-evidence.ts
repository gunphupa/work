import { z } from "zod";
import {
  publicWebUrl,
  webProjectSchema,
  type WebSource,
  type WebSearchRequest,
} from "../src/domain/web-projects";

// This is the search model's extraction, not an independently fetched page.
// Keeping it structured prevents later inventory fitting from manufacturing
// additional source-backed materials or method steps.
export const tutorialExtractionSchema = z.object({
  tutorials: z
    .array(
      z.object({
        sourceUrl: z.string().min(1).max(2000),
        title: z.string().min(1).max(180),
        description: z.string().max(700),
        materials: z
          .array(
            z.object({
              name: z.string().min(1).max(160),
              amount: z.string().max(160),
              listedAs: z.enum(["required", "optional", "unclear"]),
              sourceExcerpt: z.string().min(1).max(200),
            }),
          )
          .min(1)
          .max(20),
        steps: z
          .array(
            z.object({
              text: z.string().min(1).max(700),
              sourceExcerpt: z.string().min(1).max(240),
            }),
          )
          .min(1)
          .max(12),
        sourceTime: z.string().max(160),
        sourceDifficulty: z.string().max(160),
        sourceCost: z.string().max(160),
      }),
    )
    .max(2),
});
export type TutorialExtraction = z.infer<typeof tutorialExtractionSchema>;
export type RetrievedTutorial = TutorialExtraction["tutorials"][number] & {
  sourceId: string;
};

function sourceIdentity(raw: string) {
  const checked = publicWebUrl(raw);
  if (!checked) return null;
  const url = new URL(checked);
  // Remove only search tracking, preserving meaningful article/product queries.
  for (const key of [...url.searchParams.keys()])
    if (/^utm_/i.test(key) || /^(gclid|fbclid)$/i.test(key))
      url.searchParams.delete(key);
  return url.href;
}

export function retrievedTutorials(
  text: string,
  sources: WebSource[],
  eligibleSourceIds: string[],
): RetrievedTutorial[] {
  const data = tutorialExtractionSchema.parse(JSON.parse(text));
  return data.tutorials
    .flatMap((tutorial) => {
      const url = sourceIdentity(tutorial.sourceUrl);
      const source = sources.find(
        (entry) =>
          sourceIdentity(entry.url) === url &&
          eligibleSourceIds.includes(entry.id),
      );
      return source
        ? [{ ...tutorial, sourceUrl: source.url, sourceId: source.id }]
        : [];
    })
    .filter(
      (tutorial, index, all) =>
        all.findIndex((entry) => entry.sourceId === tutorial.sourceId) ===
        index,
    );
}

// The formatting phase cannot supply titles, descriptions, source material
// names/amounts or numbered steps. Those fields are assembled by code from the
// extraction; its role is limited to matching and explicitly separate advice.
export const tutorialFitSchema = z.object({
  projects: z
    .array(
      z.object({
        sourceId: z.string().max(20),
        fit: z.string().max(700),
        materialMatches: z
          .array(
            z.object({
              materialIndex: z.number().int().min(0).max(19),
              inventoryIds: z.array(z.string().max(100)).max(30),
              check: z.string().max(400),
            }),
          )
          .max(20),
        substitutions: webProjectSchema.shape.substitutions,
        cautions: webProjectSchema.shape.cautions,
        videoSourceIds: webProjectSchema.shape.videoSourceIds,
        shoppingSourceIds: webProjectSchema.shape.shoppingSourceIds,
      }),
    )
    .max(2),
});

export function assembleTutorialCards(
  value: unknown,
  tutorials: RetrievedTutorial[],
  input: WebSearchRequest,
) {
  const fitted = tutorialFitSchema.parse(value);
  const th = input.language === "th";
  return {
    summary: "",
    projects: fitted.projects.flatMap((fit) => {
      const tutorial = tutorials.find((item) => item.sourceId === fit.sourceId);
      if (!tutorial) return [];
      return [
        {
          title: tutorial.title,
          summary: tutorial.description,
          fit: fit.fit,
          sourceId: tutorial.sourceId,
          materials: tutorial.materials.map((material, index) => {
            const matches = fit.materialMatches.filter(
              (match) => match.materialIndex === index,
            );
            // Ambiguous duplicate mappings fail closed for this material.
            const match = matches.length === 1 ? matches[0] : undefined;
            const status =
              material.listedAs === "optional"
                ? th
                  ? "ต้นฉบับระบุว่าเป็นทางเลือกเสริม"
                  : "Optional in the source"
                : material.listedAs === "unclear"
                  ? th
                    ? "ต้นฉบับไม่ระบุว่าเป็นของจำเป็นหรือทางเลือก"
                    : "Source does not state whether this is required or optional"
                  : th
                    ? "รายการวัสดุจากต้นฉบับ"
                    : "Material listed by the source";
            return {
              name: material.name,
              amount: material.amount || "unknown",
              inventoryIds: match?.inventoryIds ?? [],
              note: `${status}. ${match?.check ?? ""}`.trim().slice(0, 400),
              sourceIds: [tutorial.sourceId],
            };
          }),
          steps: tutorial.steps.map((step) => ({
            text: step.text,
            sourceIds: [tutorial.sourceId],
          })),
          // The fitting phase cannot establish independent source support for a
          // new adaptation. Keep every generated adaptation explicitly unsourced.
          substitutions: fit.substitutions.map((item) => ({
            ...item,
            sourceIds: [],
          })),
          cautions: fit.cautions,
          videoSourceIds: fit.videoSourceIds,
          shoppingSourceIds: fit.shoppingSourceIds,
        },
      ];
    }),
  };
}

export const sourceExtractionInstructions = `Your ONLY output is a structured extraction of factual content from written tutorials actually opened by the web search tool. A citation in search snippets alone is insufficient. Search for one suitable project, then OPEN its exact written tutorial page within the two-call budget. Use inventory and preferences ONLY to choose the tutorial, NEVER to modify its contents. Extract material names from its actual Materials / Supplies / Tools section and method steps from its actual numbered method. Keep exact source material labels in their original language; do not rename them to match inventory. Mark source-listed optional items optional. Include only quantities explicitly stated for that item; otherwise amount="unknown". For each material and step include a brief exact sourceExcerpt supporting it. Step text may be a faithful concise translation into the requested language, but may not add tools, measurements or actions. Record the source's stated time, difficulty and cost exactly, otherwise "unknown". Do NOT output inventory matching, missing-supply advice, substitutions, general DIY knowledge, tips, repairs, extra weights, shopping recommendations, follow-up questions, or claims of independent verification. A generic invitation to be creative or substitute materials does not support any particular alternative. A material used by other versions of the project is not evidence for this page. Do not merge tutorials. If the page cannot be opened or does not expose its material list and method, omit it. The description must only describe the page's actual project, without unobserved testing claims. No mains wiring, opening appliances, damaged cells, pressure vessels, weapons or human-load-bearing builds. Return at most TWO source extractions and no surrounding prose.`;
