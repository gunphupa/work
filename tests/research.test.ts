import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RESEARCH_STORE,
  captureResearchSessionId,
  stopResearchTask,
  activeResearchSession,
  beginResearch,
  deleteResearchSession,
  endResearch,
  exportResearchCsv,
  finishResearchTask,
  parseResearch,
  readResearch,
  recordResearchEvent,
  researchCsvCell,
  researchSummary,
  startResearchTask,
  updateActiveResearch,
} from "../src/domain/research";

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T01:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("consent-first local research observations", () => {
  it("records nothing without active consent; strips content fields from supported events", () => {
    expect(recordResearchEvent("search_completed", { resultCount: 2 })).toBe(
      false,
    );
    expect(data.size).toBe(0);
    beginResearch("p01", "pilot", "b9af77b");
    expect(
      recordResearchEvent("search_completed", {
        resultCount: 2,
        elapsedMs: 73000,
        query: "private text",
        photo: "private photo",
      } as never),
    ).toBe(true);
    const state = readResearch();
    expect(state.sessions[0].participant).toBe("P01");
    expect(state.sessions[0].events[0].metadata).toEqual({
      resultCount: 2,
      elapsedMs: 73000,
    });
    expect(JSON.stringify(state)).not.toContain("private");
    endResearch();
    expect(recordResearchEvent("project_saved")).toBe(false);
    expect(readResearch().sessions[0].events).toHaveLength(1);
  });
  it("records wall-clock duration across navigation, distinct outcomes, errors and assistance", () => {
    beginResearch("P02", "main", "fixture");
    startResearchTask("find_project");
    vi.advanceTimersByTime(15000);
    expect(() => startResearchTask("save_reopen")).toThrow(
      "research_task_running",
    );
    stopResearchTask();
    finishResearchTask({
      outcome: "failure",
      errors: 1,
      assistance: 2,
      note: "Could not find the source",
    });
    const observation = readResearch().sessions[0].observations[0];
    expect(observation.elapsedMs).toBe(15000);
    expect(observation).toMatchObject({
      outcome: "failure",
      errors: 1,
      assistance: 2,
    });
    expect(readResearch().sessions[0].running).toBeUndefined();
  });
  it("freezes the task duration before evaluation typing and ignores wall-clock changes in the same runtime", () => {
    beginResearch("P03", "pilot", "fixture");
    startResearchTask("save_reopen");
    vi.advanceTimersByTime(5000);
    vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
    stopResearchTask();
    vi.advanceTimersByTime(120000);
    finishResearchTask({
      outcome: "success",
      assistance: 0,
      errors: 0,
      note: "Typed after stopping",
    });
    expect(readResearch().sessions[0].observations[0]).toMatchObject({
      elapsedMs: 5000,
      timingBasis: "monotonic",
    });
  });
  it("requires stopping first and rejects stale session/task actions and late async events", () => {
    const first = beginResearch("P03", "pilot", "fixture");
    const token = captureResearchSessionId();
    startResearchTask("save_reopen", first.activeId);
    expect(() =>
      finishResearchTask({
        outcome: "success",
        assistance: 0,
        errors: 0,
        note: "",
      }),
    ).toThrow("research_stop_timer_first");
    endResearch(first.activeId, true);
    const second = beginResearch("P04", "pilot", "fixture");
    expect(
      recordResearchEvent("search_completed", { resultCount: 1 }, token),
    ).toBe(false);
    expect(
      recordResearchEvent("search_completed", { resultCount: 1 }, null),
    ).toBe(false);
    expect(() => startResearchTask("find_project", first.activeId)).toThrow(
      "research_session_changed",
    );
    startResearchTask("find_project", second.activeId);
    expect(() =>
      stopResearchTask(second.activeId, crypto.randomUUID()),
    ).toThrow("research_task_changed");
    expect(readResearch().sessions[1].events).toHaveLength(0);
  });
  it("withdrawal removes the entire selected session and stops automatic recording", () => {
    const initial = beginResearch("P04", "main", "fixture");
    recordResearchEvent("search_started");
    deleteResearchSession(initial.activeId!);
    expect(readResearch()).toEqual({ version: 1, sessions: [] });
    expect(recordResearchEvent("search_completed", { resultCount: 1 })).toBe(
      false,
    );
  });
  it("invalid persisted data is preserved rather than silently overwritten", () => {
    data.set(RESEARCH_STORE, "{bad existing data");
    expect(() => beginResearch("P05", "main", "fixture")).toThrow();
    expect(recordResearchEvent("search_started")).toBe(false);
    expect(data.get(RESEARCH_STORE)).toBe("{bad existing data");
    expect(() => parseResearch("x".repeat(1_000_001))).toThrow(
      "research_too_large",
    );
  });
  it("rejects real names and overlong data and preserves previous persisted observations", () => {
    expect(() => beginResearch("Alice", "pilot", "fixture")).toThrow();
    expect(data.size).toBe(0);
    beginResearch("P10", "pilot", "fixture");
    startResearchTask("missing_materials");
    stopResearchTask();
    const before = data.get(RESEARCH_STORE);
    expect(() =>
      finishResearchTask({
        outcome: "success",
        assistance: -1,
        errors: 0,
        note: "",
      }),
    ).toThrow();
    expect(data.get(RESEARCH_STORE)).toBe(before);
    expect(
      recordResearchEvent("search_completed", { elapsedMs: Infinity }),
    ).toBe(false);
    expect(data.get(RESEARCH_STORE)).toBe(before);
  });
  it("does not overwrite newer local updates from another tab", () => {
    beginResearch("P11", "pilot", "fixture");
    const later = readResearch();
    later.sessions[0].events.push({
      name: "project_opened",
      at: new Date().toISOString(),
      metadata: {},
    });
    data.set(RESEARCH_STORE, JSON.stringify(later));
    recordResearchEvent("project_saved");
    expect(readResearch().sessions[0].events.map((e) => e.name)).toEqual([
      "project_opened",
      "project_saved",
    ]);
  });
  it("keeps pilot and main summaries separate and excludes unfinished tasks", () => {
    beginResearch("P12", "pilot", "fixture");
    startResearchTask("find_project");
    vi.advanceTimersByTime(5000);
    stopResearchTask();
    finishResearchTask({
      outcome: "success",
      assistance: 0,
      errors: 0,
      note: "",
    });
    endResearch();
    beginResearch("P13", "main", "fixture");
    startResearchTask("missing_materials");
    const summaries = researchSummary(readResearch().sessions);
    expect(summaries[0]).toMatchObject({
      attempts: 1,
      successes: 1,
      successRate: 100,
      meanSeconds: 5,
    });
    expect(summaries[1]).toMatchObject({
      attempts: 0,
      successes: 0,
      successRate: null,
      meanSeconds: null,
    });
    expect(() => endResearch()).toThrow("research_task_running");
  });
  it("makes CSV formula-safe, quoted and UTF-8 friendly without modifying stored feedback", () => {
    beginResearch("P14", "main", "fixture");
    updateActiveResearch((s) => ({
      ...s,
      feedback: {
        usefulness: 2,
        clarity: 3,
        ease: 4,
        comment: ' \t=HYPERLINK("https://bad.example")\nไทย',
        at: new Date().toISOString(),
      },
    }));
    const csv = exportResearchCsv(readResearch());
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(`"' \t=HYPERLINK(""https://bad.example"")\nไทย"`);
    expect(
      activeResearchSession(readResearch())!.feedback!.comment.startsWith(
        " \t=",
      ),
    ).toBe(true);
    for (const attack of [
      "=1+1",
      "+SUM(1)",
      "-2+3",
      "@SUM(1)",
      "\r\n=1",
      "\u0001=2",
    ])
      expect(researchCsvCell(attack)).toBe(`"'${attack}"`);
  });
  it("stops at the event limit without erasing existing records", () => {
    beginResearch("P15", "pilot", "fixture");
    updateActiveResearch((s) => ({
      ...s,
      events: Array.from({ length: 200 }, () => ({
        at: new Date().toISOString(),
        name: "search_started" as const,
        metadata: {},
      })),
    }));
    expect(recordResearchEvent("project_saved")).toBe(false);
    expect(readResearch().sessions[0].events).toHaveLength(200);
  });
});
