import { describe, expect, it } from "vitest";
import {
  EXTERNAL_PLANS_KEY,
  EXTERNAL_PLANS_MAX_BYTES,
  ExternalPlanStorageError,
  deleteExternalPlan,
  externalPlanSchema,
  importExternalPlans,
  parseExternalPlans,
  readExternalPlans,
  saveExternalPlan,
  serializeExternalPlans,
  updateExternalPlan,
  type PlanStorage,
} from "../src/domain/external-plans";
import { webRequest, webResult } from "./web-fixtures";

function memory(): PlanStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
const save = (storage: PlanStorage) =>
  saveExternalPlan(webResult.projects[0], webResult, webRequest, storage);

describe("external project snapshots", () => {
  it("persists a bounded snapshot and strips private notes/photos from the request", () => {
    const storage = memory();
    const request = {
      ...webRequest,
      materials: webRequest.materials.map((item) => ({
        ...item,
        notes: "PRIVATE",
        photo: "PRIVATE",
      })),
    };
    const plan = saveExternalPlan(
      webResult.projects[0],
      webResult,
      request,
      storage,
    );
    expect(readExternalPlans(storage).plans).toEqual([plan]);
    expect(storage.getItem(EXTERNAL_PLANS_KEY)).not.toContain("PRIVATE");
    expect(plan.project.materials[0].amount).toBe("1 sheet");
  });
  it("re-saving the same tutorial keeps its notes, progress and original snapshot", () => {
    const storage = memory();
    const plan = save(storage);
    updateExternalPlan(
      plan.id,
      { completed: [0], obtained: [1], notes: "I tested the fold." },
      storage,
    );
    const again = saveExternalPlan(
      { ...webResult.projects[0], summary: "New AI summary" },
      webResult,
      webRequest,
      storage,
    );
    expect(again.id).toBe(plan.id);
    expect(again.completed).toEqual([0]);
    expect(again.notes).toBe("I tested the fold.");
    expect(again.project.summary).toBe(plan.project.summary);
    expect(readExternalPlans(storage).plans).toHaveLength(1);
  });
  it("updates latest persisted state instead of overwriting another tab's other fields", () => {
    const storage = memory();
    const plan = save(storage);
    updateExternalPlan(plan.id, { notes: "Other tab" }, storage);
    updateExternalPlan(plan.id, { completed: [1] }, storage);
    expect(readExternalPlans(storage).plans[0].notes).toBe("Other tab");
  });
  it("detects a competing note edit and preserves it until explicitly replaced", () => {
    const storage = memory();
    const plan = save(storage);
    updateExternalPlan(plan.id, { notes: "Other tab" }, storage);
    expect(() =>
      updateExternalPlan(plan.id, { notes: "My draft" }, storage, ""),
    ).toThrow("conflict");
    expect(readExternalPlans(storage).plans[0].notes).toBe("Other tab");
    updateExternalPlan(plan.id, { notes: "My draft" }, storage);
    expect(readExternalPlans(storage).plans[0].notes).toBe("My draft");
  });
  it("rejects malformed data without replacing the original bytes", () => {
    const storage = memory();
    storage.setItem(EXTERNAL_PLANS_KEY, "{broken backup");
    expect(() => save(storage)).toThrow(ExternalPlanStorageError);
    expect(() =>
      importExternalPlans(serializeExternalPlans([]), storage),
    ).toThrow(ExternalPlanStorageError);
    expect(storage.getItem(EXTERNAL_PLANS_KEY)).toBe("{broken backup");
  });
  it("reports storage failures instead of pretending the plan is saved", () => {
    const storage: PlanStorage = {
      getItem: () => null,
      setItem: () => {
        throw Error("QuotaExceededError");
      },
    };
    expect(() => save(storage)).toThrow("unavailable");
  });
  it("rejects unsafe URLs, missing source support and foreign inventory IDs on import", () => {
    const plan = save(memory());
    expect(
      externalPlanSchema.safeParse({
        ...plan,
        sources: [{ ...plan.sources[0], url: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
    expect(externalPlanSchema.safeParse({ ...plan, sources: [] }).success).toBe(
      false,
    );
    const project = structuredClone(plan.project);
    project.materials[0].inventoryIds = ["someone-elses-item"];
    expect(externalPlanSchema.safeParse({ ...plan, project }).success).toBe(
      false,
    );
  });
  it("rejects invalid and duplicate progress indices", () => {
    const storage = memory();
    const plan = save(storage);
    expect(() =>
      updateExternalPlan(plan.id, { completed: [2] }, storage),
    ).toThrow();
    expect(() =>
      updateExternalPlan(plan.id, { obtained: [0, 0] }, storage),
    ).toThrow();
    expect(readExternalPlans(storage).plans[0].completed).toEqual([]);
  });
  it("exports and imports without replacing existing progress or touching inventory storage", () => {
    const source = memory(),
      target = memory();
    const plan = save(source);
    target.setItem("rebuild.guest.v1", "existing inventory");
    expect(importExternalPlans(serializeExternalPlans([plan]), target)).toBe(1);
    updateExternalPlan(plan.id, { completed: [0], notes: "Keep me" }, target);
    expect(importExternalPlans(serializeExternalPlans([plan]), target)).toBe(0);
    expect(readExternalPlans(target).plans[0].notes).toBe("Keep me");
    expect(target.getItem("rebuild.guest.v1")).toBe("existing inventory");
  });
  it("deduplicates the same tutorial within an imported file", () => {
    const plan = save(memory());
    const storage = memory();
    expect(
      importExternalPlans(
        serializeExternalPlans([plan, { ...plan, id: "another-id" }]),
        storage,
      ),
    ).toBe(1);
    expect(readExternalPlans(storage).plans).toHaveLength(1);
  });
  it("bounds imported byte size and duplicate IDs", () => {
    expect(() =>
      parseExternalPlans("ก".repeat(EXTERNAL_PLANS_MAX_BYTES / 3 + 1)),
    ).toThrow("full");
    const plan = save(memory());
    expect(() => serializeExternalPlans([plan, plan])).toThrow("invalid");
  });
  it("deletes only the requested plan and refuses to recreate a deleted plan from a stale edit", () => {
    const storage = memory();
    const plan = save(storage);
    deleteExternalPlan(plan.id, storage);
    expect(readExternalPlans(storage).plans).toEqual([]);
    expect(() =>
      updateExternalPlan(plan.id, { notes: "stale" }, storage),
    ).toThrow("missing");
  });
});
