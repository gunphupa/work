import { z } from "zod";
import { importState, MAX_BACKUP_BYTES } from "./inventory";
import type { SavedState } from "./schema";

export const cloudBackupMetadataSchema = z.object({
  revision: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
});
export type CloudBackupMetadata = z.infer<typeof cloudBackupMetadataSchema>;
export type CloudSnapshot = CloudBackupMetadata & { payload: SavedState };

// Reuse the local import validator: unknown projects, duplicate IDs, invalid
// checklist indices and oversized UTF-8 payloads must not bypass validation.
export function cloudPayload(state: unknown): SavedState {
  return importState(JSON.stringify(state));
}
export function parseCloudSnapshot(raw: unknown): CloudSnapshot {
  const row = z
    .object({
      revision: z.string().uuid(),
      updated_at: z.string().datetime({ offset: true }),
      payload: z.unknown(),
    })
    .parse(raw);
  return { ...row, payload: cloudPayload(row.payload) };
}
export function cloudPayloadBytes(state: SavedState) {
  return new TextEncoder().encode(JSON.stringify(state)).byteLength;
}
export { MAX_BACKUP_BYTES as MAX_CLOUD_BACKUP_BYTES };

export function cloudBackupError(
  error: unknown,
): "setup" | "conflict" | "signin" | "invalid" | "service" {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(code)) return "setup";
  if (code === "40001") return "conflict";
  if (["28000", "PGRST301", "PGRST302"].includes(code)) return "signin";
  if (["22023", "23514"].includes(code) || error instanceof z.ZodError)
    return "invalid";
  return "service";
}
