import { z } from "zod";
export const itemSchema = z.object({
  id: z.string().min(1).max(100),
  materialId: z.string().max(80),
  label: z.string().min(1).max(160),
  quantity: z.number().int().positive().max(10000),
  unit: z.enum(["ชิ้น", "เส้น", "แผ่น", "เครื่อง", "ชุด"]),
  condition: z.enum(["usable", "unknown", "damaged"]),
  specs: z
    .record(z.string().max(50), z.string().max(120))
    .refine((s) => Object.keys(s).length <= 12),
  verified: z.boolean(),
  notes: z.string().max(1000).default(""),
});
export type InventoryItem = z.infer<typeof itemSchema>;
export const progressSchema = z.object({
  projectId: z.string().max(80),
  completed: z.array(z.number().int().min(0).max(100)).max(100),
  notes: z.string().max(10000),
  measurements: z
    .array(
      z.object({
        name: z.string().max(100),
        value: z.string().max(100),
        unit: z.string().max(40),
      }),
    )
    .max(50),
  substitutions: z.record(z.string().max(80), z.string().max(500)).default({}),
  updatedAt: z.string().max(40),
});
export type Progress = z.infer<typeof progressSchema>;
export const stateSchema = z.object({
  version: z.literal(1),
  inventory: z.array(itemSchema).max(500),
  builds: z.array(progressSchema).max(100),
});
export type SavedState = z.infer<typeof stateSchema>;
export type Material = {
  id: string;
  name: string;
  en: string;
  aliases: string[];
  kind: "component" | "material" | "tool";
  unit: InventoryItem["unit"];
  specs: Record<string, { label: string; options: string[] }>;
  hint: string;
  hintEn?: string;
  group?: string;
};
export type Requirement = {
  id: string;
  label: string;
  quantity: number;
  choices: { materialId: string; specs?: Record<string, string[]> }[];
  why: string;
  optional?: boolean;
};
export type Step = {
  title: string;
  text: string;
  check: string;
  safety?: string;
};
export type Source = {
  title: string;
  url: string;
  author: string;
  language: string;
  checkedAt: string;
  inspection: string;
  commit: string;
  path: string;
};
export type Project = {
  id: string;
  title: string;
  description: string;
  category:
    | "electronics"
    | "craft"
    | "organization"
    | "cleaning"
    | "repair"
    | "gardening"
    | "science";
  level: 1 | 2 | 3;
  minutes: number;
  interest: string;
  icon: string;
  requirements: Requirement[];
  steps: Step[];
  learning: string[];
  source: Source;
  code?: string;
  wiring?: { from: string; to: string }[];
  limitations: string;
  test: { name: string; unit: string; instruction: string };
  original?: boolean;
  video?: { url: string; title: string; publisher: string; foundOn: string };
  videoQuery?: { th: string; en: string };
};
