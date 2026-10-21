import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  readSearchDraft,
  writeSearchDraft,
  readWebFeedback,
  saveWebFeedback,
  WEB_DRAFT_KEY,
  WEB_FEEDBACK_KEY,
  type SearchDraft,
} from "../src/domain/web-search-local";
function store() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
beforeEach(() => {
  vi.stubGlobal("sessionStorage", store());
  vi.stubGlobal("localStorage", store());
});
afterEach(() => vi.unstubAllGlobals());
const draft: SearchDraft = {
  version: 1,
  selected: ["paper"],
  query: "paper toy",
  difficulty: "beginner",
  maxMinutes: "30",
  maxBudgetThb: "0",
  additionalSupplies: "avoid",
};
const feedback = {
  sourceUrl: "https://example.org/tutorial",
  projectTitle: "Paper toy",
  searchedAt: "2026-10-21T12:00:00.000Z",
  outcome: "materials_mismatch" as const,
  note: "Source requires thicker paper.",
};
describe("local search draft and explicit feedback", () => {
  it("restores a bounded tab draft without storing inventory photos or notes", () => {
    writeSearchDraft({ ...draft, photos: ["private"] } as SearchDraft);
    expect(readSearchDraft()).toEqual(draft);
    expect(sessionStorage.getItem(WEB_DRAFT_KEY)).not.toContain("private");
    expect(localStorage.getItem(WEB_DRAFT_KEY)).toBeNull();
  });
  it("rejects malformed draft and keeps original bytes for explicit reset", () => {
    sessionStorage.setItem(WEB_DRAFT_KEY, "broken data");
    expect(readSearchDraft).toThrow();
    expect(sessionStorage.getItem(WEB_DRAFT_KEY)).toBe("broken data");
  });
  it("stores explicit feedback locally, validates links and strips extra identifiers", () => {
    const entry = saveWebFeedback({
      ...feedback,
      email: "private@example.org",
    } as typeof feedback);
    expect(entry.id).toBeTruthy();
    expect(readWebFeedback()).toEqual([entry]);
    expect(localStorage.getItem(WEB_FEEDBACK_KEY)).not.toContain(
      "private@example.org",
    );
    expect(() =>
      saveWebFeedback({ ...feedback, sourceUrl: "javascript:alert(1)" }),
    ).toThrow();
    expect(readWebFeedback()).toEqual([entry]);
  });
  it("preserves unreadable feedback instead of silently replacing records", () => {
    localStorage.setItem(WEB_FEEDBACK_KEY, "bad original");
    expect(() => saveWebFeedback(feedback)).toThrow();
    expect(localStorage.getItem(WEB_FEEDBACK_KEY)).toBe("bad original");
  });
  it("bounds UTF-8 feedback bytes before storage becomes unreadable", () => {
    const large = {
      ...feedback,
      sourceUrl: `https://example.org/${"a".repeat(1900)}`,
      projectTitle: "ก".repeat(180),
      note: "ข".repeat(500),
    };
    let accepted = 0;
    for (let i = 0; i < 200; i++) {
      try {
        saveWebFeedback(large);
        accepted++;
      } catch {
        break;
      }
    }
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(200);
    expect(readWebFeedback()).toHaveLength(accepted);
  });
  it("does not discard old feedback when full or storage writes fail", () => {
    for (let i = 0; i < 200; i++) saveWebFeedback(feedback);
    const original = localStorage.getItem(WEB_FEEDBACK_KEY);
    expect(() => saveWebFeedback(feedback)).toThrow();
    expect(localStorage.getItem(WEB_FEEDBACK_KEY)).toBe(original);
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw Error("quota");
      },
    });
    expect(() => saveWebFeedback(feedback)).toThrow("quota");
  });
});
