import { z } from "zod";

export const submissionSchema = z
  .object({
    target: z.string().min(1).max(80),
    kind: z.enum(["comment", "review"]),
    name: z.string().trim().min(2).max(60),
    body: z.string().trim().min(10).max(3000),
    rating: z.number().int().min(1).max(5).nullable().default(null),
    difficulty: z.enum(["easy", "moderate", "hard"]).nullable().default(null),
    outcome: z.enum(["worked", "partly", "not-yet"]).nullable().default(null),
    photo: z.string().max(2800000).optional(),
    guidelines: z.literal(true),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.kind === "review") !== (v.rating !== null))
      ctx.addIssue({
        code: "custom",
        message: "Only reviews require a rating.",
      });
    if (
      v.target === "website" &&
      (v.kind !== "review" || v.difficulty || v.outcome || v.photo)
    )
      ctx.addIssue({
        code: "custom",
        message: "Website reviews do not include build details.",
      });
    if (v.kind === "comment" && (v.difficulty || v.outcome))
      ctx.addIssue({
        code: "custom",
        message: "Build ratings belong in reviews.",
      });
  });
export type Submission = z.infer<typeof submissionSchema>;
export type Entry = {
  id: string;
  user_id: string;
  target: string;
  kind: "comment" | "review";
  name: string;
  body: string;
  rating: number | null;
  difficulty: string | null;
  outcome: string | null;
  photo_path: string | null;
  status: "pending" | "approved" | "rejected";
  moderation_note: string;
  created_at: string;
};
export type PublicEntry = Omit<Entry, "user_id" | "photo_path"> & {
  hasPhoto: boolean;
};
