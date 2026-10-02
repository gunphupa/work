import data from "./projects.json";
import household from "./household-projects.json";
import english from "./projects.en.json";
import householdEnglish from "./household-projects.en.json";
import type { Project } from "../domain/schema";
import type { Language } from "../i18n";
export const projects = [...household, ...data] as Project[];
type Copy = Pick<
  Project,
  "title" | "description" | "steps" | "learning" | "limitations" | "test"
> & {
  requirements: { label: string; why: string }[];
  wiring?: Project["wiring"];
};
export const englishCopies: Record<string, Copy> = {
  ...english,
  ...householdEnglish,
};
export function localizeProject(project: Project, language: Language): Project {
  if (language === "th") return project;
  const copy = englishCopies[project.id];
  return {
    ...project,
    ...copy,
    requirements: project.requirements.map((r, i) => ({
      ...r,
      ...copy.requirements[i],
    })),
    source: {
      ...project.source,
      inspection: project.original
        ? "An original ReBuild household guide. Not physically tested."
        : "Written source reviewed. No physical build test has been performed.",
    },
  };
}
export const categories = [
  { id: "all", th: "ทั้งหมด", en: "All projects", symbol: "✳" },
  { id: "organization", th: "จัดบ้าน", en: "Organize", symbol: "▦" },
  { id: "cleaning", th: "ทำความสะอาด", en: "Cleaning", symbol: "✧" },
  { id: "repair", th: "ซ่อมของ", en: "Repairs", symbol: "↗" },
  { id: "craft", th: "งานประดิษฐ์", en: "Crafts", symbol: "◈" },
  { id: "gardening", th: "ปลูกต้นไม้", en: "Gardening", symbol: "❧" },
  { id: "science", th: "วิทยาศาสตร์", en: "Science", symbol: "◎" },
  { id: "electronics", th: "อิเล็กทรอนิกส์", en: "Electronics", symbol: "⌁" },
] as const;
export const projectById = Object.assign(
  Object.create(null),
  Object.fromEntries(projects.map((p) => [p.id, p])),
) as Record<string, Project>;
