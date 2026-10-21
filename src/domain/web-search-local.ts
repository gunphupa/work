import { z } from "zod";
import { publicWebUrl } from "./web-projects";

export const WEB_DRAFT_KEY = "rebuild.web-search-draft.v1";
export const WEB_FEEDBACK_KEY = "rebuild.web-feedback.v1";
const draftSchema = z.object({
  version: z.literal(1),
  selected: z.array(z.string().max(100)).max(30),
  query: z.string().max(2000),
  difficulty: z.enum(["any", "beginner", "intermediate"]),
  maxMinutes: z.string().max(5),
  maxBudgetThb: z.string().max(9),
  additionalSupplies: z.enum(["allow", "avoid"]),
});
export type SearchDraft = z.infer<typeof draftSchema>;
export function readSearchDraft(): SearchDraft | null {
  const raw = sessionStorage.getItem(WEB_DRAFT_KEY);
  if (!raw) return null;
  if (raw.length > 16000) throw Error("invalid draft");
  return draftSchema.parse(JSON.parse(raw));
}
export function writeSearchDraft(draft: SearchDraft) {
  sessionStorage.setItem(
    WEB_DRAFT_KEY,
    JSON.stringify(draftSchema.parse(draft)),
  );
}
const feedbackSchema = z.object({
  id: z.string().uuid(),
  sourceUrl: z
    .string()
    .max(2000)
    .refine((value) => publicWebUrl(value) !== null),
  projectTitle: z.string().max(180),
  searchedAt: z.string().datetime(),
  savedAt: z.string().datetime(),
  outcome: z.enum(["useful", "materials_mismatch", "broken_link", "other"]),
  note: z.string().trim().max(500),
});
export type WebFeedback = z.infer<typeof feedbackSchema>;
const feedbackStoreSchema = z.object({
  version: z.literal(1),
  entries: z.array(feedbackSchema).max(200),
});
export function readWebFeedback(): WebFeedback[] {
  const raw = localStorage.getItem(WEB_FEEDBACK_KEY);
  if (!raw) return [];
  if (new TextEncoder().encode(raw).byteLength > 600000)
    throw Error("Feedback storage too large");
  return feedbackStoreSchema.parse(JSON.parse(raw)).entries;
}
export function saveWebFeedback(input: Omit<WebFeedback, "id" | "savedAt">) {
  const entries = readWebFeedback();
  if (entries.length >= 200) throw Error("Feedback storage is full");
  const next = feedbackSchema.parse({
    ...input,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  });
  const serialized = JSON.stringify({
    version: 1,
    entries: [...entries, next],
  });
  if (new TextEncoder().encode(serialized).byteLength > 600000)
    throw Error("Feedback storage is full");
  localStorage.setItem(WEB_FEEDBACK_KEY, serialized);
  return next;
}
export function downloadWebFeedback() {
  const entries = readWebFeedback();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ version: 1, entries }, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "rebuild-web-feedback.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Recovery preserves the exact stored bytes instead of requiring a valid schema.
export function downloadSearchRecovery(kind: "draft" | "feedback") {
  const raw =
    kind === "draft"
      ? sessionStorage.getItem(WEB_DRAFT_KEY)
      : localStorage.getItem(WEB_FEEDBACK_KEY);
  if (raw === null) throw Error("No stored data");
  const url = URL.createObjectURL(
    new Blob([raw], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `rebuild-${kind}-recovery.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
