import data from "./projects.json";
import type { Project } from "../domain/schema";
export const projects = data as Project[];
export const projectById = Object.assign(
  Object.create(null),
  Object.fromEntries(projects.map((p) => [p.id, p])),
) as Record<string, Project>;
