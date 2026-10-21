import { describe, expect, it } from "vitest";
import {
  cloudPayload,
  cloudBackupError,
  parseCloudSnapshot,
} from "../src/domain/cloud-backup";

const state = { version: 1, inventory: [], builds: [] };
describe("private cloud backup validation", () => {
  it("round trips existing local version 1 backups and rejects invalid progress", () => {
    expect(cloudPayload(state)).toEqual(state);
    expect(() =>
      cloudPayload({
        ...state,
        builds: [
          {
            projectId: "invented",
            completed: [],
            notes: "",
            measurements: [],
            updatedAt: "",
          },
        ],
      }),
    ).toThrow();
  });
  it("validates metadata and rejects excessive UTF-8 payloads before restoration", () => {
    const snapshot = {
      revision: "00000000-0000-4000-8000-000000000001",
      updated_at: "2026-10-21T08:00:00+00:00",
      payload: state,
    };
    expect(parseCloudSnapshot(snapshot).payload).toEqual(state);
    expect(() =>
      parseCloudSnapshot({ ...snapshot, revision: "not-a-revision" }),
    ).toThrow();
    expect(() =>
      cloudPayload({ ...state, extra: "ก".repeat(700000) }),
    ).toThrow();
  });
  it("distinguishes owner setup, revision conflicts and authentication failures", () => {
    expect(cloudBackupError({ code: "PGRST205" })).toBe("setup");
    expect(cloudBackupError({ code: "40001" })).toBe("conflict");
    expect(cloudBackupError({ code: "28000" })).toBe("signin");
    expect(cloudBackupError({ code: "23514" })).toBe("invalid");
    expect(cloudBackupError(new Error("Network"))).toBe("service");
  });
});
