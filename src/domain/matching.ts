import { materialById } from "../data/materials";
import type { InventoryItem, Project, Requirement } from "./schema";
export type RequirementStatus =
  "satisfied" | "short" | "missing" | "incompatible" | "unknown";
export type RequirementResult = {
  requirement: Requirement;
  status: RequirementStatus;
  available: number;
  missing: number;
  items: string[];
};
export type Match = {
  project: Project;
  requirements: RequirementResult[];
  state: "ready" | "missing" | "verify";
  fulfilled: number;
  needed: number;
  reused: number;
  reason: string;
};
function compatibility(
  item: InventoryItem,
  r: Requirement,
): "yes" | "unknown" | "no" {
  const choices = r.choices.filter((c) => c.materialId === item.materialId);
  if (
    !choices.length ||
    item.condition === "damaged" ||
    item.unit !== materialById[item.materialId]?.unit
  )
    return "no";
  let unknown = false;
  for (const c of choices) {
    let mismatch = false;
    let uncertain = !item.verified || item.condition === "unknown";
    for (const [key, values] of Object.entries(c.specs ?? {})) {
      if (!item.specs[key]) uncertain = true;
      else if (!values.includes(item.specs[key])) mismatch = true;
    }
    if (!mismatch && !uncertain) return "yes";
    if (!mismatch) unknown = true;
  }
  return unknown ? "unknown" : "no";
}
// Maximum flow allocates each available unit once, including overlapping alternative groups.
export function matchProject(
  project: Project,
  inventory: InventoryItem[],
): Match {
  const reqs = project.requirements.filter((r) => !r.optional),
    n = inventory.length,
    m = reqs.length,
    S = 0,
    T = n + m + 1,
    N = T + 1;
  const capacity = Array.from(
      { length: N },
      () => Array(N).fill(0) as number[],
    ),
    flow = Array.from({ length: N }, () => Array(N).fill(0) as number[]);
  inventory.forEach((item, i) => {
    capacity[S][i + 1] = item.quantity;
    reqs.forEach((r, j) => {
      if (compatibility(item, r) === "yes")
        capacity[i + 1][n + j + 1] = Math.min(item.quantity, r.quantity);
    });
  });
  reqs.forEach((r, j) => (capacity[n + j + 1][T] = r.quantity));
  while (true) {
    const parent = Array(N).fill(-1);
    parent[S] = S;
    const queue = [S];
    for (let k = 0; k < queue.length && parent[T] < 0; k++) {
      const u = queue[k];
      for (let v = 0; v < N; v++)
        if (parent[v] < 0 && capacity[u][v] - flow[u][v] > 1e-8) {
          parent[v] = u;
          queue.push(v);
        }
    }
    if (parent[T] < 0) break;
    let add = Infinity;
    for (let v = T; v !== S; v = parent[v])
      add = Math.min(add, capacity[parent[v]][v] - flow[parent[v]][v]);
    for (let v = T; v !== S; v = parent[v]) {
      flow[parent[v]][v] += add;
      flow[v][parent[v]] -= add;
    }
  }
  const results = reqs.map((r, j): RequirementResult => {
    const available = flow[n + j + 1][T];
    const same = inventory.filter((i) =>
      r.choices.some((c) => c.materialId === i.materialId),
    );
    const uncertain = same.some((i) => compatibility(i, r) === "unknown");
    const valid = same.some((i) => compatibility(i, r) === "yes");
    const status: RequirementStatus =
      available >= r.quantity
        ? "satisfied"
        : uncertain
          ? "unknown"
          : available > 0 || valid
            ? "short"
            : same.length
              ? "incompatible"
              : "missing";
    return {
      requirement: r,
      status,
      available,
      missing: Math.max(0, r.quantity - available),
      items: inventory
        .filter((_, i) => flow[i + 1][n + j + 1] > 0)
        .map((i) => i.id),
    };
  });
  const fulfilled = results.filter((r) => r.status === "satisfied").length;
  const state =
    fulfilled === results.length
      ? "ready"
      : results.some(
            (r) => r.status === "unknown" || r.status === "incompatible",
          )
        ? "verify"
        : "missing";
  return {
    project,
    requirements: results,
    state,
    fulfilled,
    needed: results.filter(
      (r) => r.status === "missing" || r.status === "short",
    ).length,
    reused: results.reduce((s, r) => s + r.available, 0),
    reason: `ยืนยันครบ ${fulfilled} จาก ${results.length} รายการที่จำเป็น`,
  };
}
export type Filters = {
  category: string;
  level: string;
  time: string;
  purchases: boolean;
  interest: string;
  toolsOnly: boolean;
  query: string;
};
export function recommend(
  projects: Project[],
  inventory: InventoryItem[],
  f: Filters,
): Match[] {
  return projects
    .map((p) => matchProject(p, inventory))
    .filter(
      (m) =>
        (f.category === "all" || m.project.category === f.category) &&
        (f.level === "all" || m.project.level <= Number(f.level)) &&
        (f.time === "all" || m.project.minutes <= Number(f.time)) &&
        (f.purchases || m.needed === 0) &&
        (f.interest === "all" || m.project.interest === f.interest) &&
        (!f.toolsOnly ||
          m.requirements
            .filter((r) =>
              r.requirement.choices.some(
                (c) => materialById[c.materialId]?.kind === "tool",
              ),
            )
            .every((r) => r.status === "satisfied")) &&
        (!f.query ||
          `${m.project.title} ${m.project.description} ${m.project.learning.join(" ")}`
            .toLowerCase()
            .includes(f.query.toLowerCase())),
    )
    .sort(
      (a, b) =>
        ({ ready: 0, verify: 1, missing: 2 })[a.state] -
          { ready: 0, verify: 1, missing: 2 }[b.state] ||
        b.fulfilled - a.fulfilled ||
        a.needed - b.needed ||
        a.project.minutes - b.project.minutes ||
        a.project.id.localeCompare(b.project.id),
    );
}
export const statusLabels: Record<RequirementStatus, string> = {
  satisfied: "มีครบ",
  short: "จำนวนไม่พอ",
  missing: "ยังไม่มี",
  incompatible: "สเปกไม่ตรง",
  unknown: "ต้องยืนยัน",
};
export const stateLabels = {
  ready: "พร้อมทำจากของที่ยืนยันแล้ว",
  missing: "ต้องเพิ่มบางชิ้น",
  verify: "ต้องตรวจสอบข้อมูลก่อน",
};
