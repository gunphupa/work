import type {
  WebSearchRequest,
  WebSearchResult,
} from "../src/domain/web-projects";
export const webRequest: WebSearchRequest = {
  language: "en",
  query: "Make a simple toy",
  materials: [
    {
      id: "paper-1",
      materialId: "unknown",
      label: "scrap paper",
      quantity: 3,
      unit: "แผ่น",
      condition: "usable",
      specs: {},
    },
    {
      id: "tape-1",
      materialId: "unknown",
      label: "tape",
      quantity: 1,
      unit: "ชิ้น",
      condition: "unknown",
      specs: {},
    },
  ],
};
export const webResult: WebSearchResult = {
  summary:
    "Synthetic test result, not a real search or participant observation.",
  searchedAt: "2026-10-21T03:00:00.000Z",
  searchCalls: 1,
  sources: [
    {
      id: "s1",
      title: "Synthetic paper spinner tutorial",
      url: "https://example.org/paper-spinner",
    },
    {
      id: "s2",
      title: "Synthetic video tutorial",
      url: "https://example.org/spinner-video",
    },
    {
      id: "s3",
      title: "Synthetic pencil product",
      url: "https://example.org/pencil",
    },
  ],
  projects: [
    {
      title: "Paper spinner — test fixture",
      summary: "A paper toy using the chosen material group.",
      fit: "Paper can form the body. Check the thickness and provide a pencil.",
      sourceId: "s1",
      materials: [
        {
          name: "Paper",
          amount: "1 sheet",
          inventoryIds: ["paper-1"],
          note: "Check the thickness.",
          sourceIds: ["s1"],
        },
        {
          name: "Pencil",
          amount: "1",
          inventoryIds: [],
          note: "Not selected.",
          sourceIds: ["s1"],
        },
      ],
      steps: [
        {
          text: "Fold the paper following the original diagram.",
          sourceIds: ["s1"],
        },
        { text: "Place the pencil as the guide describes.", sourceIds: ["s1"] },
      ],
      substitutions: [
        {
          missing: "Glue",
          alternative: "Tape",
          conditions: "For lightweight paper only; untested suggestion.",
          inventoryIds: ["tape-1"],
          sourceIds: [],
        },
      ],
      cautions: ["Check the original instructions before starting."],
      videoSourceIds: ["s2"],
      shoppingSourceIds: ["s3"],
    },
  ],
};
