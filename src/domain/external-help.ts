import { z } from "zod";
import {
  webSourceSchema,
  type WebProject,
  type WebSource,
} from "./web-projects";

const sourceIds = z.array(z.string().min(1).max(20)).min(1).max(6);
// A visible tutorial snapshot, deliberately separate from a saved plan: no
// private notes, inventory, photographs, location, or progress are included.
export const externalHelpContextSchema = z
  .object({
    title: z.string().min(1).max(180),
    sourceId: z.string().min(1).max(20),
    materials: z
      .array(
        z.object({
          name: z.string().min(1).max(160),
          amount: z.string().max(160),
          note: z.string().max(400),
          sourceIds,
        }),
      )
      .min(1)
      .max(20),
    steps: z
      .array(z.object({ text: z.string().min(1).max(700), sourceIds }))
      .min(1)
      .max(12),
    cautions: z.array(z.string().max(350)).max(6),
    sources: z.array(webSourceSchema).min(1).max(60),
  })
  .superRefine((context, ctx) => {
    const ids = new Set(context.sources.map((source) => source.id));
    if (
      ids.size !== context.sources.length ||
      !ids.has(context.sourceId) ||
      [...context.materials, ...context.steps].some((part) =>
        part.sourceIds.some((id) => !ids.has(id)),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid tutorial source references",
      });
    }
  });
export type ExternalHelpContext = z.infer<typeof externalHelpContextSchema>;
export function externalHelpContext(
  project: WebProject,
  sources: WebSource[],
): ExternalHelpContext {
  const referenced = new Set([
    project.sourceId,
    ...project.materials.flatMap((part) => part.sourceIds),
    ...project.steps.flatMap((part) => part.sourceIds),
  ]);
  return externalHelpContextSchema.parse({
    ...project,
    sources: sources.filter((source) => referenced.has(source.id)),
  });
}

export function externalHelpReply(reply: string, language: "th" | "en") {
  // Answers are plain text. All outgoing clickable URLs come from the source
  // registry rendered separately, not from a model-generated response.
  return reply.replace(
    /(?:https?:\/\/|www\.)[^\s<>"']+/gi,
    language === "th"
      ? "[ดูลิงก์ต้นฉบับด้านล่าง]"
      : "[see original source links below]",
  );
}
