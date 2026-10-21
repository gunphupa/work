import {
  researchStateSchema,
  researchTasks,
  type ResearchSession,
  type ResearchState,
} from "./research";

function equal(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function prefix(older: unknown[], newer: unknown[]) {
  return (
    older.length <= newer.length &&
    older.every((item, i) => equal(item, newer[i]))
  );
}
function follows(older: ResearchSession, newer: ResearchSession) {
  if (
    !prefix(older.observations, newer.observations) ||
    !prefix(older.events, newer.events)
  )
    return false;
  if (older.endedAt && older.endedAt !== newer.endedAt) return false;
  if (older.feedback) {
    if (!newer.feedback || newer.feedback.at < older.feedback.at) return false;
    if (
      newer.feedback.at === older.feedback.at &&
      !equal(older.feedback, newer.feedback)
    )
      return false;
  }
  return true;
}
/** Merge repeat exports by session UUID; inconsistent histories fail rather than double-count. */
export function mergeResearchExports(inputs: ResearchState[]): ResearchState {
  const sessions = new Map<string, ResearchSession>();
  for (const input of inputs) {
    for (const rawSession of researchStateSchema.parse(input).sessions) {
      // Incomplete timers are not observations and must not resume when analyzing exports.
      const incoming = { ...rawSession, running: undefined };
      const previous = sessions.get(incoming.id);
      if (!previous) {
        sessions.set(incoming.id, incoming);
        continue;
      }
      const immutable = (s: ResearchSession) => [
        s.id,
        s.participant,
        s.phase,
        s.consentVersion,
        s.consentedAt,
        s.release,
      ];
      if (!equal(immutable(previous), immutable(incoming)))
        throw Error(
          `Conflicting identity or study metadata for session ${incoming.id}`,
        );
      if (follows(previous, incoming)) sessions.set(incoming.id, incoming);
      else if (!follows(incoming, previous))
        throw Error(
          `Conflicting observation history for session ${incoming.id}`,
        );
    }
  }
  return researchStateSchema.parse({
    version: 1,
    sessions: [...sessions.values()].sort(
      (a, b) =>
        a.consentedAt.localeCompare(b.consentedAt) || a.id.localeCompare(b.id),
    ),
  });
}
export function analyzeResearch(state: ResearchState) {
  return (["pilot", "main"] as const).flatMap((phase) =>
    researchTasks.map((task) => {
      const sessions = state.sessions.filter((s) => s.phase === phase);
      const attempts = sessions.flatMap((s) =>
        s.observations
          .filter((o) => o.task === task)
          .map((o) => ({ ...o, participant: s.participant })),
      );
      const times = attempts
        .map((o) => o.elapsedMs / 1000)
        .sort((a, b) => a - b);
      const successes = attempts.filter((o) => o.outcome === "success").length;
      const mean = times.length
        ? times.reduce((a, b) => a + b, 0) / times.length
        : null;
      return {
        phase,
        task,
        participant_codes: new Set(attempts.map((o) => o.participant)).size,
        attempts: attempts.length,
        successes,
        failures: attempts.filter((o) => o.outcome === "failure").length,
        abandoned: attempts.filter((o) => o.outcome === "abandoned").length,
        success_percent: attempts.length
          ? (successes / attempts.length) * 100
          : null,
        mean_seconds: mean,
        median_seconds: times.length
          ? (times[Math.floor((times.length - 1) / 2)] +
              times[Math.floor(times.length / 2)]) /
            2
          : null,
        min_seconds: times[0] ?? null,
        max_seconds: times.at(-1) ?? null,
        total_help: attempts.reduce((n, o) => n + o.assistance, 0),
        total_errors: attempts.reduce((n, o) => n + o.errors, 0),
        wall_clock_attempts: attempts.filter(
          (o) => o.timingBasis === "wall_clock",
        ).length,
      };
    }),
  );
}
