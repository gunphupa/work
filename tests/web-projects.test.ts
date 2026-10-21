import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "openai/resources/responses/responses";
import {
  collectSearchEvidence,
  groundWebProjects,
  isWrittenTutorialUrl,
  openAIWebSearchProvider,
} from "../server/web-projects";
import {
  publicWebUrl,
  searchMaterialsPayload,
  webSearchRequestSchema,
} from "../src/domain/web-projects";
import { webRequest, webResult } from "./web-fixtures";
const mock = vi.hoisted(() => ({ create: vi.fn(), parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = mock;
  },
}));
const response = (output: unknown[], status = "completed") =>
  ({ output, status }) as Pick<Response, "output" | "status">;
const call = {
  type: "web_search_call",
  status: "completed",
  action: {
    type: "search",
    sources: [{ url: "https://example.org/paper-spinner" }],
  },
};
const message = {
  type: "message",
  content: [
    {
      type: "output_text",
      text: "A retrieved tutorial with materials and steps.",
      annotations: [
        {
          type: "url_citation",
          url: "https://example.org/paper-spinner",
          title: "Actual citation title",
        },
      ],
    },
  ],
};
beforeEach(() => vi.resetAllMocks());
describe("live web search boundaries (controlled provider responses)", () => {
  it("sends custom material names and excludes local photos/private notes", () => {
    const payload = searchMaterialsPayload([
      {
        ...webRequest.materials[0],
        verified: false,
        notes: "private",
        photo: "data:image/webp;base64,AA==",
      },
    ]);
    expect(payload[0].label).toBe("scrap paper");
    expect(payload[0]).not.toHaveProperty("photo");
    expect(payload[0]).not.toHaveProperty("notes");
    expect(
      webSearchRequestSchema.parse({
        ...webRequest,
        materials: [{ ...payload[0], photo: "secret" }],
      }).materials[0],
    ).not.toHaveProperty("photo");
  });
  it("allows a text-only material query and rejects empty, duplicate or oversized requests", () => {
    expect(
      webSearchRequestSchema.safeParse({ query: "paper tape pencil" }).success,
    ).toBe(true);
    expect(webSearchRequestSchema.safeParse({ query: "  " }).success).toBe(
      false,
    );
    expect(
      webSearchRequestSchema.safeParse({
        ...webRequest,
        materials: [webRequest.materials[0], webRequest.materials[0]],
      }).success,
    ).toBe(false);
    expect(
      webSearchRequestSchema.safeParse({ query: "a".repeat(2001) }).success,
    ).toBe(false);
    expect(
      webSearchRequestSchema.safeParse({
        ...webRequest,
        materials: Array.from({ length: 31 }, (_, i) => ({
          ...webRequest.materials[0],
          id: String(i),
        })),
      }).success,
    ).toBe(false);
  });
  it("rejects unsafe link schemes, credentials and local network destinations", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "file:///etc/passwd",
      "https://localhost/x",
      "http://127.0.0.1",
      "http://2130706433",
      "http://[::1]",
      "https://foo.internal/x",
      "https://user:pass@example.org/x",
      "https://example.org:123/x",
    ])
      expect(publicWebUrl(url)).toBeNull();
    expect(publicWebUrl("https://example.org/tutorial#step")).toBe(
      "https://example.org/tutorial",
    );
  });
  it("requires an actual completed web tool call and refuses truncated output", () => {
    expect(() => collectSearchEvidence(response([message]))).toThrow();
    expect(() =>
      collectSearchEvidence(response([{ ...call, status: "failed" }, message])),
    ).toThrow();
    expect(() =>
      collectSearchEvidence(response([call, message], "incomplete")),
    ).toThrow();
  });
  it("collects provider citations/sources only, deduplicates, and ignores URLs invented in prose", () => {
    const data = collectSearchEvidence(
      response([
        call,
        {
          ...message,
          content: [
            {
              ...message.content[0],
              text: "Also see https://invented.org/fake",
              annotations: [
                ...message.content[0].annotations,
                { type: "url_citation", url: "javascript:bad()", title: "bad" },
              ],
            },
          ],
        },
      ]),
    );
    expect(data.sources).toEqual([
      {
        id: "s1",
        url: "https://example.org/paper-spinner",
        title: "Actual citation title",
      },
    ]);
    expect(data.searchCalls).toBe(1);
  });
  it("drops unsupported projects, steps and invented links rather than inventing citations", () => {
    const draft = structuredClone(webResult);
    draft.projects[0].steps[0].sourceIds = ["invented"];
    expect(
      groundWebProjects(draft, draft.sources, webRequest).projects,
    ).toEqual([]);
    draft.projects[0].steps[0].sourceIds = ["s1"];
    draft.projects[0].videoSourceIds.push("made-up");
    draft.projects[0].shoppingSourceIds.push("fake");
    const result = groundWebProjects(draft, draft.sources, webRequest);
    expect(result.projects[0].videoSourceIds).toEqual(["s2"]);
    expect(result.projects[0].shoppingSourceIds).toEqual(["s3"]);
  });
  it("never invents owned items or treats damaged items as available", () => {
    const draft = structuredClone(webResult);
    draft.projects[0].materials[0].inventoryIds.push("fake-item", "tape-1");
    const input = structuredClone(webRequest);
    input.materials[1].condition = "damaged";
    const result = groundWebProjects(draft, draft.sources, input);
    expect(result.projects[0].materials[0].inventoryIds).toEqual(["paper-1"]);
    expect(result.projects[0].substitutions[0].inventoryIds).toEqual([]);
    expect(result.projects[0].substitutions[0].sourceIds).toEqual([]);
  });
  it("forces live search, bounds calls, then extracts structured results from retrieved evidence", async () => {
    mock.create.mockResolvedValue(response([call, message]));
    mock.parse.mockResolvedValue({
      status: "completed",
      output_parsed: webResult,
    });
    const signal = new AbortController().signal;
    const output = await openAIWebSearchProvider("test-key", "gpt-4.1-mini")(
      webRequest,
      signal,
    );
    const [search, options] = mock.create.mock.calls[0];
    expect(search.tools[0]).toMatchObject({
      type: "web_search",
      external_web_access: true,
    });
    expect(search).toMatchObject({
      tool_choice: "required",
      max_tool_calls: 2,
      store: false,
    });
    expect(search.include).toContain("web_search_call.action.sources");
    expect(options.signal).toBe(signal);
    expect(mock.parse.mock.calls[0][0].input).toContain(
      "Actual citation title",
    );
    expect(output.projects).toHaveLength(1);
    expect(output.projects[0].videoSourceIds).toEqual([]); // s2 was never retrieved
    expect(output.sources).toHaveLength(1);
    expect(mock.create).toHaveBeenCalledTimes(2);
    expect(mock.create.mock.calls[1][0].max_tool_calls).toBe(1);
    expect(output.searchCalls).toBe(2);
  });
  it("does not build a written guide from a video listing or supplemental source", () => {
    expect(isWrittenTutorialUrl("https://www.youtube.com/watch?v=abc")).toBe(
      false,
    );
    expect(isWrittenTutorialUrl("https://www.google.com/search?q=paper")).toBe(
      false,
    );
    const draft = structuredClone(webResult);
    draft.projects[0].sourceId = "s2";
    expect(
      groundWebProjects(draft, draft.sources, webRequest, ["s1"]).projects,
    ).toEqual([]);
  });
  it("retains written tutorials if a supplemental video/product search fails", async () => {
    mock.create
      .mockResolvedValueOnce(response([call, message]))
      .mockRejectedValueOnce(Error("supplement failed"));
    mock.parse.mockResolvedValue({
      status: "completed",
      output_parsed: webResult,
    });
    const output = await openAIWebSearchProvider("test-key", "gpt-4.1-mini")(
      webRequest,
      new AbortController().signal,
    );
    expect(output.projects).toHaveLength(1);
    expect(output.searchCalls).toBe(1);
    expect(output.projects[0].videoSourceIds).toEqual([]);
  });
  it("reports no results honestly without running extraction when sources are absent", async () => {
    mock.create.mockResolvedValue(
      response([{ ...call, action: { type: "search", sources: [] } }]),
    );
    const output = await openAIWebSearchProvider("test-key", "gpt-4.1-mini")(
      webRequest,
      new AbortController().signal,
    );
    expect(output.projects).toEqual([]);
    expect(mock.parse).not.toHaveBeenCalled();
  });
});
