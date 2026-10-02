import { describe, it, expect } from "vitest";
import { matchProject, recommend } from "../src/domain/matching";
import {
  projects,
  projectById,
  localizeProject,
  categories,
} from "../src/data/projects";
import { searchProjects, searchMaterials } from "../src/domain/catalogue";
import { materials, materialById } from "../src/data/materials";
import {
  parseInventory,
  importState,
  mergeConfirmed,
} from "../src/domain/inventory";
import type { InventoryItem, Project } from "../src/domain/schema";
function complete(project: Project) {
  return project.requirements.map((r, i): InventoryItem => ({
    id: String(i),
    materialId: r.choices[0].materialId,
    label: r.label,
    quantity: r.quantity,
    unit: materialById[r.choices[0].materialId].unit,
    condition: "usable",
    specs: Object.fromEntries(
      Object.entries(r.choices[0].specs ?? {}).map(([k, v]) => [k, v[0]]),
    ),
    verified: true,
    notes: "",
  }));
}
const f = {
  category: "all",
  level: "all",
  time: "all",
  purchases: true,
  interest: "all",
  toolsOnly: false,
  query: "",
};
describe("catalogue readiness", () => {
  it.each(projects.map((p) => [p.id, p] as const))(
    "%s accepts all necessary confirmed parts",
    (_id, p) => {
      expect(matchProject(p, complete(p)).state).toBe("ready");
    },
  );
  it("does not mark a board-only inventory ready", () => {
    const board = complete(projectById.blink).slice(0, 1);
    for (const p of projects)
      expect(matchProject(p, board).state).not.toBe("ready");
  });
  it("requires the programming computer and data cable even for onboard LED", () => {
    for (const id of ["usb", "computer"]) {
      const result = matchProject(
        projectById.blink,
        complete(projectById.blink).filter((i) => i.materialId !== id),
      );
      expect(result.state).toBe("missing");
    }
  });
  it("requires enough wires", () => {
    const inventory = complete(projectById.fade);
    inventory.find((i) => i.materialId === "jumper")!.quantity = 1;
    const result = matchProject(projectById.fade, inventory);
    expect(result.state).toBe("missing");
    expect(
      result.requirements.find(
        (r) => r.requirement.choices[0].materialId === "jumper",
      )?.status,
    ).toBe("short");
  });
  it.each(["unknown", "incompatible", "unconfirmed", "damaged", "wrong-unit"])(
    "rejects %s critical specifications",
    (kind) => {
      const items = complete(projectById.blink);
      if (kind === "unknown") items[0].specs = {};
      if (kind === "incompatible") items[0].specs.model = "UNO R4";
      if (kind === "unconfirmed") items[0].verified = false;
      if (kind === "damaged") items[0].condition = "damaged";
      if (kind === "wrong-unit") items[0].unit = "เส้น";
      expect(matchProject(projectById.blink, items).state).toBe("verify");
    },
  );
  it("allows a reviewed resistor alternative and never requires both", () => {
    const items = complete(projectById.fade);
    items.find((i) => i.materialId === "resistor")!.specs.ohms = "330";
    expect(matchProject(projectById.fade, items).state).toBe("ready");
  });
  it("allocates overlapping alternatives without consuming one part twice", () => {
    const p = {
      ...projectById.blink,
      requirements: [
        {
          id: "either",
          label: "either",
          quantity: 1,
          choices: [{ materialId: "led" }, { materialId: "button" }],
          why: "",
        },
        {
          id: "only-led",
          label: "only-led",
          quantity: 1,
          choices: [{ materialId: "led" }],
          why: "",
        },
      ],
    };
    const item = (id: string): InventoryItem => ({
      id,
      materialId: id,
      label: id,
      quantity: 1,
      unit: "ชิ้น",
      verified: true,
      condition: "usable",
      specs: {},
      notes: "",
    });
    expect(matchProject(p, [item("led")]).state).toBe("missing");
    expect(matchProject(p, [item("led"), item("button")]).state).toBe("ready");
  });
  it("never substitutes a single resistor for two different resistance values", () => {
    const items = complete(projectById.calibrate).filter(
      (i) => !(i.materialId === "resistor" && i.specs.ohms === "10000"),
    );
    expect(matchProject(projectById.calibrate, items).state).not.toBe("ready");
  });
  it("excludes all purchase requirements under no-additional-items preference", () => {
    const results = recommend(projects, complete(projectById.blink), {
      ...f,
      purchases: false,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((x) => x.needed === 0)).toBe(true);
    expect(results.some((x) => x.project.id === "fade")).toBe(false);
  });
  it("applies time, difficulty and search filters", () => {
    expect(
      recommend(projects, [], {
        ...f,
        time: "20",
        level: "1",
        query: "ไฟ",
      }).map((m) => m.project.id),
    ).toEqual(["blink"]);
  });
  it("distinguishes original household guides from reviewed external references", () => {
    expect(projects).toHaveLength(37);
    expect(projects.filter((p) => p.original)).toHaveLength(21);
    for (const p of projects) {
      if (p.category === "electronics")
        expect(p.source.url).toMatch(
          /^https:\/\/github.com\/arduino\/docs-content\/blob\/[a-f0-9]{40}\//,
        );
      if (p.category === "electronics")
        expect(p.code).toContain("void setup()");
      else if (!p.original)
        expect(p.source.url).toBe(
          "https://www.jpl.nasa.gov/edu/resources/project/make-a-straw-rocket/",
        );
      else expect(p.source.author).toBe("ReBuild");
      expect(p.steps.length).toBeGreaterThan(2);
      expect(
        p.requirements.every((r) =>
          r.choices.every((c) => materials.some((m) => m.id === c.materialId)),
        ),
      ).toBe(true);
    }
  });
  it("keeps every category populated and translations aligned with the same requirements and step IDs", () => {
    for (const category of categories.filter((c) => c.id !== "all"))
      expect(projects.some((p) => p.category === category.id)).toBe(true);
    for (const p of projects) {
      const en = localizeProject(p, "en");
      expect(en.title).not.toMatch(/[\u0e00-\u0e7f]/);
      expect(en.steps).toHaveLength(p.steps.length);
      expect(en.requirements.map((r) => r.id)).toEqual(
        p.requirements.map((r) => r.id),
      );
      expect(en.requirements.map((r) => [r.quantity, r.choices])).toEqual(
        p.requirements.map((r) => [r.quantity, r.choices]),
      );
      expect(
        JSON.stringify([
          en.title,
          en.description,
          en.steps,
          en.learning,
          en.requirements.map((r) => [r.label, r.why]),
          en.test,
          en.wiring,
          en.limitations,
        ]),
      ).not.toMatch(/[\u0e00-\u0e7f]/);
      expect(matchProject(en, complete(p)).state).toBe("ready");
      expect(new Set(p.requirements.map((r) => r.id)).size).toBe(
        p.requirements.length,
      );
    }
  });
  it("finds practical projects by English, Thai and material aliases", () => {
    expect(
      searchProjects("drawer").some((p) => p.id === "drawer-dividers"),
    ).toBe(true);
    expect(searchProjects("กล่อง").some((p) => p.id === "marble-maze")).toBe(
      true,
    );
    expect(searchProjects("t-shirt").some((p) => p.id === "tshirt-tote")).toBe(
      true,
    );
    expect(searchProjects("ไมโครเวฟ")).toEqual([]);
    expect(searchMaterials("cotton cord").map((m) => m.id)).toContain(
      "cotton-string",
    );
  });
  it("uses only declared material specification options and keeps alternatives interchangeable", () => {
    for (const p of projects)
      for (const r of p.requirements)
        for (const c of r.choices) {
          for (const [key, values] of Object.entries(c.specs ?? {}))
            for (const value of values)
              expect(materialById[c.materialId].specs[key].options).toContain(
                value,
              );
          const all = complete(p);
          const index = p.requirements.indexOf(r);
          all[index] = {
            ...all[index],
            materialId: c.materialId,
            unit: materialById[c.materialId].unit,
            specs: Object.fromEntries(
              Object.entries(c.specs ?? {}).map(([k, v]) => [k, v[0]]),
            ),
          };
          expect(matchProject(p, all).state).toBe("ready");
        }
  });
});
describe("inventory and backups", () => {
  it("distinguishes measuring tape from adhesive tape", () => {
    expect(
      parseInventory("measuring tape 1\ntape measure 1\nเทปกาว 1").map(
        (item) => item.materialId,
      ),
    ).toEqual(["ruler", "ruler", "tape"]);
  });
  it("recognizes household aliases and does not match English aliases inside unrelated words", () => {
    const list = parseInventory(
      "Plastic bottles qty 2\nเสื้อยืด จำนวน 1\ncardboard tubes 3\nsewing button 4\nclothing button 1\nmarble 1\nmarbled fabric 1\ncapacitance meter 1\nsoil 1",
    );
    expect(list.map((i) => i.materialId)).toEqual([
      "bottle",
      "tshirt",
      "tube",
      "sewing-button",
      "sewing-button",
      "marble",
      "unknown",
      "unknown",
      "soil",
    ]);
    expect(list.slice(0, 4).map((i) => i.quantity)).toEqual([2, 1, 3, 4]);
  });
  it("imports existing v1 builds without losing notes, materials or checked steps", () => {
    const state = {
      version: 1,
      inventory: complete(projectById.fade),
      builds: [
        {
          projectId: "fade",
          completed: [0, 2],
          notes: "Existing notes",
          measurements: [{ name: "Trial", value: "2", unit: "s" }],
          substitutions: { "resistor-220": "330 ohm" },
          updatedAt: "2026-10-01T00:00:00Z",
        },
      ],
    };
    expect(importState(JSON.stringify(state))).toEqual(state);
  });
  it("normalizes Thai and English aliases without merging unconfirmed objects", () => {
    const result = parseInventory(
      "LED จำนวน 2\nหลอดแอลอีดี จำนวน 3\nตัวต้านทาน 220 ohm จำนวน 4",
    );
    expect(result.map((i) => i.materialId)).toEqual(["led", "led", "resistor"]);
    expect(result.map((i) => i.quantity)).toEqual([2, 3, 4]);
    expect(result[2].specs.ohms).toBe("220");
    expect(result.every((i) => !i.verified)).toBe(true);
  });
  it("preserves unsupported objects", () => {
    const [item] = parseInventory("กล่องเครื่องดนตรีโบราณ");
    expect(item.materialId).toBe("unknown");
    expect(item.label).toBe("กล่องเครื่องดนตรีโบราณ");
  });
  it("merges only explicitly requested identical entries without losing quantities", () => {
    const items = parseInventory("LED จำนวน 2\nLED จำนวน 2");
    expect(mergeConfirmed(items)[0].quantity).toBe(4);
    expect(items[0].quantity).toBe(2);
  });
  it("round trips export data and refuses malformed data and duplicate IDs", () => {
    const inventory = complete(projectById.blink);
    const data = { version: 1, inventory, builds: [] };
    expect(importState(JSON.stringify(data))).toEqual(data);
    expect(() => importState("{bad")).toThrow();
    expect(() =>
      importState(
        JSON.stringify({ ...data, inventory: [inventory[0], inventory[0]] }),
      ),
    ).toThrow();
    expect(() =>
      importState(JSON.stringify({ ...data, version: 2 })),
    ).toThrow();
  });
});
