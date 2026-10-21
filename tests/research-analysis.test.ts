import { describe, expect, it } from "vitest";
import {
  analyzeResearch,
  mergeResearchExports,
} from "../src/domain/research-analysis";
import type { ResearchSession, ResearchState } from "../src/domain/research";
const session: ResearchSession = {
  id: "11111111-1111-4111-8111-111111111111",
  participant: "P01",
  phase: "main",
  release: "fixture",
  consentVersion: "2026-10-21-v1",
  consentedAt: "2026-10-21T01:00:00.000Z",
  observations: [],
  events: [],
};
const observation = {
  id: "22222222-2222-4222-8222-222222222222",
  task: "find_project" as const,
  startedAt: "2026-10-21T01:00:00.000Z",
  finishedAt: "2026-10-21T01:00:10.000Z",
  elapsedMs: 10000,
  timingBasis: "monotonic" as const,
  outcome: "success" as const,
  assistance: 1,
  errors: 0,
  note: "Synthetic test fixture",
};
const state = (sessions: ResearchSession[]): ResearchState => ({
  version: 1,
  sessions,
});
describe("research export analysis", () => {
  it("deduplicates identical/repeated exports and chooses the compatible longer snapshot in either order", () => {
    const early = state([session]);
    const later = state([{ ...session, observations: [observation] }]);
    expect(mergeResearchExports([early, later, later])).toEqual(later);
    expect(mergeResearchExports([later, early])).toEqual(later);
  });
  it("rejects conflicting task records or identity instead of silently selecting data", () => {
    const first = state([{ ...session, observations: [observation] }]);
    const conflicting = state([
      { ...session, observations: [{ ...observation, outcome: "failure" }] },
    ]);
    expect(() => mergeResearchExports([first, conflicting])).toThrow(
      "Conflicting observation history",
    );
    expect(() =>
      mergeResearchExports([
        first,
        state([{ ...session, participant: "P02" }]),
      ]),
    ).toThrow("Conflicting identity");
  });
  it("separates phase/task denominators and does not turn unfinished timers into observations", () => {
    const pilot = {
      ...session,
      id: "33333333-3333-4333-8333-333333333333",
      phase: "pilot" as const,
      running: {
        id: observation.id,
        task: observation.task,
        startedAt: observation.startedAt,
      },
    };
    const merged = mergeResearchExports([
      state([{ ...session, observations: [observation] }, pilot]),
    ]);
    const rows = analyzeResearch(merged);
    expect(
      merged.sessions.find((s) => s.phase === "pilot")!.running,
    ).toBeUndefined();
    expect(
      rows.find((r) => r.phase === "main" && r.task === "find_project"),
    ).toMatchObject({
      attempts: 1,
      successes: 1,
      success_percent: 100,
      mean_seconds: 10,
      median_seconds: 10,
      total_help: 1,
    });
    expect(
      rows.find((r) => r.phase === "pilot" && r.task === "find_project"),
    ).toMatchObject({ attempts: 0, success_percent: null, mean_seconds: null });
  });
});
