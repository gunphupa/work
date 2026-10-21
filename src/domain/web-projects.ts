import { z } from "zod";
import { itemSchema, type InventoryItem } from "./schema";

// Only selected material details leave the browser. Local photos are never sent.
export const searchMaterialSchema = itemSchema.pick({
  id: true,
  materialId: true,
  label: true,
  quantity: true,
  unit: true,
  condition: true,
  specs: true,
});
export const webSearchRequestSchema = z
  .object({
    language: z.enum(["th", "en"]).default("th"),
    query: z.string().trim().max(2000).default(""),
    materials: z.array(searchMaterialSchema).max(30).default([]),
  })
  .refine((x) => x.materials.length > 0 || x.query.length > 0, {
    message: "Materials or a query required",
  })
  .refine((x) => JSON.stringify(x).length <= 20000, {
    message: "Material context too large",
  })
  .refine(
    (x) => new Set(x.materials.map((m) => m.id)).size === x.materials.length,
    {
      message: "Duplicate material IDs",
    },
  );
export type WebSearchRequest = z.infer<typeof webSearchRequestSchema>;
export function searchMaterialsPayload(items: InventoryItem[]) {
  return items.map((item) => searchMaterialSchema.parse(item));
}

// Links must come from the search tool, never from generated prose.
export function publicWebUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (
      !/^https?:$/.test(u.protocol) ||
      u.username ||
      u.password ||
      (u.port && u.port !== "80" && u.port !== "443") ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/i.test(
        u.hostname,
      )
    )
      return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}
export const webSourceSchema = z.object({
  id: z.string().max(20),
  title: z.string().max(300),
  url: z
    .string()
    .max(2000)
    .refine((url) => publicWebUrl(url) !== null),
});
export type WebSource = z.infer<typeof webSourceSchema>;
const refs = z.array(z.string().max(20)).max(6);
const itemIds = z.array(z.string().max(100)).max(30);
export const webProjectSchema = z.object({
  title: z.string().min(1).max(180),
  summary: z.string().max(700),
  fit: z.string().max(700),
  sourceId: z.string().max(20),
  materials: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        amount: z.string().max(160),
        inventoryIds: itemIds,
        note: z.string().max(400),
        sourceIds: refs.min(1),
      }),
    )
    .min(1)
    .max(20),
  steps: z
    .array(
      z.object({
        text: z.string().min(1).max(700),
        sourceIds: refs.min(1),
      }),
    )
    .min(1)
    .max(12),
  substitutions: z
    .array(
      z.object({
        missing: z.string().max(160),
        alternative: z.string().max(160),
        conditions: z.string().max(500),
        inventoryIds: itemIds,
        sourceIds: refs,
      }),
    )
    .max(6),
  cautions: z.array(z.string().max(350)).max(6),
  videoSourceIds: refs,
  shoppingSourceIds: refs,
});
export const webSearchDraftSchema = z.object({
  summary: z.string().max(1200),
  projects: z.array(webProjectSchema).max(3),
});
export const webSearchResultSchema = webSearchDraftSchema.extend({
  searchedAt: z.string().datetime(),
  sources: z.array(webSourceSchema).max(60),
  searchCalls: z.number().int().min(1).max(3),
});
export type WebProject = z.infer<typeof webProjectSchema>;
export type WebSearchResult = z.infer<typeof webSearchResultSchema>;
