import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseResearch,
  exportResearchCsv,
  researchCsvCell,
} from "../src/domain/research";
import {
  analyzeResearch,
  mergeResearchExports,
} from "../src/domain/research-analysis";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "--out" || !args[1] || args.length < 3 || args.length > 202)
    throw Error(
      "Usage: npx tsx scripts/analyze-research.ts --out NEW_OUTPUT_DIRECTORY participant1.json participant2.json ... (up to 200 files; at most 50 distinct sessions per batch)",
    );
  const output = resolve(args[1]);
  const inputs = await Promise.all(
    args.slice(2).map(async (path) => {
      try {
        return parseResearch(await readFile(path, "utf8"));
      } catch {
        throw Error(`Invalid or oversized research export: ${path}`);
      }
    }),
  );
  const merged = mergeResearchExports(inputs);
  const summary = analyzeResearch(merged);
  const headers = Object.keys(summary[0]) as (keyof (typeof summary)[number])[];
  const summaryCsv =
    "\uFEFF" +
    [headers, ...summary.map((row) => headers.map((key) => row[key] ?? ""))]
      .map((row) => row.map(researchCsvCell).join(","))
      .join("\r\n");
  const participantSessions = new Map<string, number>();
  for (const s of merged.sessions)
    participantSessions.set(
      `${s.phase}:${s.participant}`,
      (participantSessions.get(`${s.phase}:${s.participant}`) ?? 0) + 1,
    );
  const repeats = [...participantSessions.entries()].filter(
    ([, count]) => count > 1,
  );
  // A fresh directory prevents accidental replacement of earlier analyses.
  await mkdir(output, { recursive: false });
  await Promise.all([
    writeFile(
      resolve(output, "combined-research.json"),
      JSON.stringify(merged, null, 2),
      { flag: "wx" },
    ),
    writeFile(resolve(output, "observations.csv"), exportResearchCsv(merged), {
      flag: "wx",
    }),
    writeFile(resolve(output, "task-summary.csv"), summaryCsv, { flag: "wx" }),
    writeFile(
      resolve(output, "analysis-notes.txt"),
      [
        `Input files: ${inputs.length}. Unique session UUIDs: ${merged.sessions.length}.`,
        "Repeat exports are deduplicated by session UUID. Conflicting histories are rejected.",
        "Pilot and main studies are separated. Only saved observations count; incomplete timers are excluded.",
        "Every saved attempt counts, including repeats. Participant codes are labels, not verified identities.",
        "Use researcher-assigned unique codes. Do not infer a representative population from a convenience friend sample.",
        "Task durations use a monotonic clock within one page runtime; wall_clock fallback after reload is counted separately.",
        "Outcome, assistance and error counts are participant/observer reports, not independently verified physical builds.",
        "CSV formulas are escaped; exported files may still contain free-text comments and must be handled privately.",
        repeats.length
          ? `Repeated code/session combinations to review: ${repeats.map(([key, count]) => `${key} (${count} sessions)`).join(", ")}`
          : "No repeated code/session combinations within a study stage.",
        "No statistical significance, population-level effectiveness, or project completion claim is inferred by this script.",
      ].join("\n") + "\n",
      { flag: "wx" },
    ),
  ]);
  process.stdout.write(
    `Analyzed ${merged.sessions.length} distinct sessions into ${output}\n`,
  );
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Analysis failed"}\n`,
  );
  process.exitCode = 1;
});
