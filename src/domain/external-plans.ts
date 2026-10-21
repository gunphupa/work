import { z } from "zod";
import {
  webProjectSchema,
  webSearchRequestSchema,
  webSourceSchema,
  type WebProject,
  type WebSearchRequest,
  type WebSearchResult,
} from "./web-projects";

export const EXTERNAL_PLANS_KEY = "rebuild.external-plans.v1";
export const EXTERNAL_PLANS_EVENT = "rebuild:external-plans-changed";
export const EXTERNAL_PLANS_MAX_BYTES = 2_000_000;
export const EXTERNAL_PLANS_MAX_COUNT = 50;
const uniqueIndexes = (max: number) =>
  z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(max - 1),
    )
    .max(max)
    .refine((indexes) => new Set(indexes).size === indexes.length);
export const externalPlanSchema = z
  .object({
    id: z.string().min(1).max(100),
    project: webProjectSchema,
    sources: z.array(webSourceSchema).min(1).max(60),
    request: webSearchRequestSchema,
    searchedAt: z.string().datetime(),
    savedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completed: uniqueIndexes(12),
    obtained: uniqueIndexes(20),
    notes: z.string().max(10000),
  })
  .superRefine((plan, ctx) => {
    const sourceIds = new Set(plan.sources.map((source) => source.id));
    const inventoryIds = new Set(
      plan.request.materials.map((material) => material.id),
    );
    const referencedSources = [
      plan.project.sourceId,
      ...plan.project.materials.flatMap((material) => material.sourceIds),
      ...plan.project.steps.flatMap((step) => step.sourceIds),
      ...plan.project.substitutions.flatMap(
        (substitution) => substitution.sourceIds,
      ),
      ...plan.project.videoSourceIds,
      ...plan.project.shoppingSourceIds,
    ];
    const referencedMaterials = [
      ...plan.project.materials.flatMap((material) => material.inventoryIds),
      ...plan.project.substitutions.flatMap(
        (substitution) => substitution.inventoryIds,
      ),
    ];
    if (
      sourceIds.size !== plan.sources.length ||
      referencedSources.some((id) => !sourceIds.has(id)) ||
      referencedMaterials.some((id) => !inventoryIds.has(id)) ||
      plan.completed.some((index) => index >= plan.project.steps.length) ||
      plan.obtained.some((index) => index >= plan.project.materials.length)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid external plan references or progress",
      });
    }
  });
export const externalPlansBackupSchema = z
  .object({
    format: z.literal("rebuild-external-plans"),
    version: z.literal(1),
    plans: z.array(externalPlanSchema).max(EXTERNAL_PLANS_MAX_COUNT),
  })
  .refine(
    (state) =>
      new Set(state.plans.map((plan) => plan.id)).size === state.plans.length,
  );
export type ExternalPlan = z.infer<typeof externalPlanSchema>;
export type ExternalPlansBackup = z.infer<typeof externalPlansBackupSchema>;
export type PlanStorage = Pick<Storage, "getItem" | "setItem">;
export class ExternalPlanStorageError extends Error {
  constructor(
    public readonly reason:
      "unavailable" | "invalid" | "full" | "missing" | "conflict",
  ) {
    super(`External plan storage: ${reason}`);
  }
}
const empty = (): ExternalPlansBackup => ({
  format: "rebuild-external-plans",
  version: 1,
  plans: [],
});
const byteLength = (raw: string) => new TextEncoder().encode(raw).byteLength;
function storageOrDefault(storage?: PlanStorage): PlanStorage {
  try {
    return storage ?? localStorage;
  } catch {
    throw new ExternalPlanStorageError("unavailable");
  }
}
export function parseExternalPlans(raw: string): ExternalPlansBackup {
  if (byteLength(raw) > EXTERNAL_PLANS_MAX_BYTES)
    throw new ExternalPlanStorageError("full");
  try {
    return externalPlansBackupSchema.parse(JSON.parse(raw));
  } catch {
    throw new ExternalPlanStorageError("invalid");
  }
}
export function readExternalPlans(storage?: PlanStorage): ExternalPlansBackup {
  let raw: string | null;
  try {
    raw = storageOrDefault(storage).getItem(EXTERNAL_PLANS_KEY);
  } catch {
    throw new ExternalPlanStorageError("unavailable");
  }
  return raw === null ? empty() : parseExternalPlans(raw);
}
function writeExternalPlans(state: ExternalPlansBackup, storage?: PlanStorage) {
  const checked = externalPlansBackupSchema.safeParse(state);
  if (!checked.success) throw new ExternalPlanStorageError("invalid");
  const raw = JSON.stringify(checked.data);
  if (byteLength(raw) > EXTERNAL_PLANS_MAX_BYTES)
    throw new ExternalPlanStorageError("full");
  try {
    storageOrDefault(storage).setItem(EXTERNAL_PLANS_KEY, raw);
  } catch {
    throw new ExternalPlanStorageError("unavailable");
  }
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(EXTERNAL_PLANS_EVENT));
}
function sourceUrl(plan: Pick<ExternalPlan, "project" | "sources">) {
  return plan.sources.find((source) => source.id === plan.project.sourceId)
    ?.url;
}
export function saveExternalPlan(
  project: WebProject,
  result: WebSearchResult,
  request: WebSearchRequest,
  storage?: PlanStorage,
): ExternalPlan {
  // Reading before writing prevents corruption or an unreadable backup from being silently erased.
  const state = readExternalPlans(storage);
  const existing = state.plans.find(
    (plan) =>
      plan.project.title === project.title &&
      sourceUrl(plan) === sourceUrl({ project, sources: result.sources }),
  );
  if (existing) return existing;
  if (state.plans.length >= EXTERNAL_PLANS_MAX_COUNT)
    throw new ExternalPlanStorageError("full");
  const now = new Date().toISOString();
  const plan = externalPlanSchema.parse({
    id: crypto.randomUUID(),
    project,
    sources: result.sources,
    request,
    searchedAt: result.searchedAt,
    savedAt: now,
    updatedAt: now,
    completed: [],
    obtained: [],
    notes: "",
  });
  writeExternalPlans({ ...state, plans: [plan, ...state.plans] }, storage);
  return plan;
}
export function updateExternalPlan(
  id: string,
  patch: Partial<Pick<ExternalPlan, "completed" | "obtained" | "notes">>,
  storage?: PlanStorage,
  expectedNotes?: string,
) {
  const state = readExternalPlans(storage);
  if (
    expectedNotes !== undefined &&
    state.plans.find((plan) => plan.id === id)?.notes !== expectedNotes
  )
    throw new ExternalPlanStorageError("conflict");
  if (!state.plans.some((plan) => plan.id === id))
    throw new ExternalPlanStorageError("missing");
  const updated = state.plans.map((plan) =>
    plan.id === id
      ? externalPlanSchema.parse({
          ...plan,
          ...patch,
          updatedAt: new Date().toISOString(),
        })
      : plan,
  );
  writeExternalPlans({ ...state, plans: updated }, storage);
}
export function deleteExternalPlan(id: string, storage?: PlanStorage) {
  const state = readExternalPlans(storage);
  writeExternalPlans(
    { ...state, plans: state.plans.filter((plan) => plan.id !== id) },
    storage,
  );
}
export function importExternalPlans(
  raw: string,
  storage?: PlanStorage,
): number {
  const incoming = parseExternalPlans(raw);
  const current = readExternalPlans(storage);
  // Import adds missing plans; existing notes and progress always win over a backup.
  const additions: ExternalPlan[] = [];
  for (const plan of incoming.plans) {
    if (
      ![...current.plans, ...additions].some(
        (present) =>
          present.id === plan.id ||
          (present.project.title === plan.project.title &&
            sourceUrl(present) === sourceUrl(plan)),
      )
    )
      additions.push(plan);
  }
  if (current.plans.length + additions.length > EXTERNAL_PLANS_MAX_COUNT)
    throw new ExternalPlanStorageError("full");
  writeExternalPlans(
    { ...current, plans: [...current.plans, ...additions] },
    storage,
  );
  return additions.length;
}
export function serializeExternalPlans(plans: ExternalPlan[]) {
  const raw = JSON.stringify({ ...empty(), plans });
  parseExternalPlans(raw);
  return raw;
}
export function downloadExternalPlans(plans: ExternalPlan[]) {
  const url = URL.createObjectURL(
    new Blob([serializeExternalPlans(plans)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "rebuild-external-plans.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
