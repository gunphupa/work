import { z } from "zod";

export const RESEARCH_STORE = "rebuild.research.v1";
export const RESEARCH_CHANGED = "rebuild:research-changed";
export const RESEARCH_MAX_BYTES = 1_000_000;
export const researchTasks = [
  "find_project",
  "missing_materials",
  "explain_steps",
  "save_reopen",
] as const;
export type ResearchTask = (typeof researchTasks)[number];
export const researchEventNames = [
  "search_started",
  "search_completed",
  "search_failed",
  "search_cancelled",
  "project_saved",
  "project_opened",
  "result_feedback",
] as const;
const date = z.string().datetime();
const id = z.string().uuid();
export const researchMetadataSchema = z.object({
  target: z.enum(["source", "saved_plan"]).optional(),
  elapsedMs: z.number().int().min(0).max(600000).optional(),
  resultCount: z.number().int().min(0).max(100).optional(),
  cached: z.boolean().optional(),
  outcome: z
    .enum(["useful", "materials_mismatch", "broken_link", "other"])
    .optional(),
  status: z.enum(["success", "error", "cancelled"]).optional(),
});
const taskSchema = z.object({
  id,
  task: z.enum(researchTasks),
  startedAt: date,
  finishedAt: date,
  elapsedMs: z.number().int().min(0).max(86400000),
  timingBasis: z.enum(["monotonic", "wall_clock"]).default("wall_clock"),
  outcome: z.enum(["success", "failure", "abandoned"]),
  assistance: z.number().int().min(0).max(100),
  errors: z.number().int().min(0).max(100),
  note: z.string().max(1000),
});
const sessionSchema = z.object({
  id,
  participant: z.string().regex(/^P\d{2,4}$/),
  phase: z.enum(["pilot", "main"]),
  consentVersion: z.literal("2026-10-21-v1"),
  consentedAt: date,
  release: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/),
  endedAt: date.optional(),
  running: z
    .object({
      id,
      task: z.enum(researchTasks),
      startedAt: date,
      stoppedAt: date.optional(),
      elapsedMs: z.number().int().min(0).max(86400000).optional(),
      timingBasis: z.enum(["monotonic", "wall_clock"]).optional(),
    })
    .optional(),
  observations: z.array(taskSchema).max(40),
  events: z
    .array(
      z.object({
        at: date,
        name: z.enum(researchEventNames),
        metadata: researchMetadataSchema,
      }),
    )
    .max(200),
  feedback: z
    .object({
      usefulness: z.number().int().min(1).max(5),
      clarity: z.number().int().min(1).max(5),
      ease: z.number().int().min(1).max(5),
      comment: z.string().max(1000),
      at: date,
    })
    .optional(),
});
export const researchStateSchema = z
  .object({
    version: z.literal(1),
    activeId: id.optional(),
    sessions: z.array(sessionSchema).max(50),
  })
  .superRefine((state, ctx) => {
    if (new Set(state.sessions.map((s) => s.id)).size !== state.sessions.length)
      ctx.addIssue({ code: "custom", message: "Duplicate session IDs" });
    if (
      state.activeId &&
      !state.sessions.some((s) => s.id === state.activeId && !s.endedAt)
    )
      ctx.addIssue({
        code: "custom",
        message: "Active session is missing or ended",
      });
    for (const session of state.sessions) {
      const ids = session.observations.map((observation) => observation.id);
      if (
        new Set(ids).size !== ids.length ||
        (session.running && ids.includes(session.running.id))
      )
        ctx.addIssue({
          code: "custom",
          message: "Duplicate task observation IDs",
        });
      if (session.endedAt && session.running)
        ctx.addIssue({
          code: "custom",
          message: "An ended session cannot have a running task",
        });
      const timer = session.running;
      if (
        timer &&
        (!!timer.stoppedAt !== (timer.elapsedMs !== undefined) ||
          !!timer.stoppedAt !== !!timer.timingBasis)
      )
        ctx.addIssue({ code: "custom", message: "Incomplete stopped timer" });
    }
  });
export type ResearchState = z.infer<typeof researchStateSchema>;
export type ResearchSession = z.infer<typeof sessionSchema>;
export type ResearchEventName = (typeof researchEventNames)[number];
export type ResearchMetadata = z.infer<typeof researchMetadataSchema>;
export type ResearchObservation = z.infer<typeof taskSchema>;
let lastRecordingError = "";
const taskClocks = new Map<string, number>();
export function researchElapsedMs(
  running: NonNullable<ResearchSession["running"]>,
): number {
  if (running.elapsedMs !== undefined) return running.elapsedMs;
  const start = taskClocks.get(running.id);
  return Math.max(
    0,
    Math.round(
      start === undefined
        ? Date.now() - Date.parse(running.startedAt)
        : performance.now() - start,
    ),
  );
}
export function researchRecordingError() {
  return lastRecordingError;
}
export function parseResearch(raw: string): ResearchState {
  if (new TextEncoder().encode(raw).byteLength > RESEARCH_MAX_BYTES)
    throw Error("research_too_large");
  return researchStateSchema.parse(JSON.parse(raw));
}
export function readResearch(
  storage: Pick<Storage, "getItem"> = localStorage,
): ResearchState {
  const raw = storage.getItem(RESEARCH_STORE);
  return raw ? parseResearch(raw) : { version: 1, sessions: [] };
}
export function updateResearch(
  change: (state: ResearchState) => ResearchState,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): ResearchState {
  // Read immediately before each synchronous write, including updates from other tabs.
  const next = researchStateSchema.parse(change(readResearch(storage)));
  const raw = JSON.stringify(next);
  if (new TextEncoder().encode(raw).byteLength > RESEARCH_MAX_BYTES)
    throw Error("research_too_large");
  storage.setItem(RESEARCH_STORE, raw);
  lastRecordingError = "";
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(RESEARCH_CHANGED));
  return next;
}
export function activeResearchSession(state: ResearchState) {
  return state.sessions.find((s) => s.id === state.activeId && !s.endedAt);
}
export function beginResearch(
  participant: string,
  phase: "pilot" | "main",
  release: string,
): ResearchState {
  return updateResearch((state) => {
    if (activeResearchSession(state)) throw Error("research_already_active");
    const session: ResearchSession = {
      id: crypto.randomUUID(),
      participant: participant.trim().toUpperCase(),
      phase,
      consentVersion: "2026-10-21-v1",
      consentedAt: new Date().toISOString(),
      release,
      observations: [],
      events: [],
    };
    return {
      ...state,
      activeId: session.id,
      sessions: [...state.sessions, session],
    };
  });
}
export function updateActiveResearch(
  change: (session: ResearchSession) => ResearchSession,
  expectedSessionId?: string,
): ResearchState {
  return updateResearch((state) => {
    const active = activeResearchSession(state);
    if (!active) throw Error("research_consent_required");
    if (expectedSessionId && active.id !== expectedSessionId)
      throw Error("research_session_changed");
    return {
      ...state,
      sessions: state.sessions.map((s) => (s.id === active.id ? change(s) : s)),
    };
  });
}
export function startResearchTask(
  task: ResearchTask,
  expectedSessionId?: string,
): ResearchState {
  const taskId = crypto.randomUUID();
  const next = updateActiveResearch((session) => {
    if (session.running) throw Error("research_task_running");
    if (session.observations.length >= 40) throw Error("research_task_limit");
    return {
      ...session,
      running: { id: taskId, task, startedAt: new Date().toISOString() },
    };
  }, expectedSessionId);
  taskClocks.set(taskId, performance.now());
  return next;
}
export function stopResearchTask(
  expectedSessionId?: string,
  expectedTaskId?: string,
): ResearchState {
  return updateActiveResearch((session) => {
    const running = session.running;
    if (!running || (expectedTaskId && running.id !== expectedTaskId))
      throw Error("research_task_changed");
    if (running.stoppedAt) return session;
    const start = taskClocks.get(running.id);
    const elapsedMs = Math.round(
      start === undefined
        ? Date.now() - Date.parse(running.startedAt)
        : performance.now() - start,
    );
    if (elapsedMs < 0 || elapsedMs > 86400000)
      throw Error("research_clock_invalid");
    return {
      ...session,
      running: {
        ...running,
        stoppedAt: new Date().toISOString(),
        elapsedMs,
        timingBasis: start === undefined ? "wall_clock" : "monotonic",
      },
    };
  }, expectedSessionId);
}
export function discardResearchTask(
  expectedSessionId: string,
  expectedTaskId: string,
): ResearchState {
  return updateActiveResearch((session) => {
    if (session.running?.id !== expectedTaskId)
      throw Error("research_task_changed");
    taskClocks.delete(expectedTaskId);
    return { ...session, running: undefined };
  }, expectedSessionId);
}
export function finishResearchTask(
  input: Pick<
    ResearchObservation,
    "outcome" | "assistance" | "errors" | "note"
  >,
  expectedSessionId?: string,
  expectedTaskId?: string,
): ResearchState {
  return updateActiveResearch((session) => {
    const running = session.running;
    if (!running || (expectedTaskId && running.id !== expectedTaskId))
      throw Error("research_task_changed");
    if (!running.stoppedAt || running.elapsedMs === undefined)
      throw Error("research_stop_timer_first");
    const observation = taskSchema.parse({
      ...running,
      ...input,
      finishedAt: running.stoppedAt,
    });
    taskClocks.delete(running.id);
    return {
      ...session,
      running: undefined,
      observations: [...session.observations, observation],
    };
  }, expectedSessionId);
}
export function endResearch(
  expectedSessionId?: string,
  discardRunning = false,
): ResearchState {
  return updateResearch((state) => {
    const active = activeResearchSession(state);
    if (!active) throw Error("research_consent_required");
    if (expectedSessionId && active.id !== expectedSessionId)
      throw Error("research_session_changed");
    if (active.running && !discardRunning) throw Error("research_task_running");
    if (active.running) taskClocks.delete(active.running.id);
    return {
      ...state,
      activeId: undefined,
      sessions: state.sessions.map((s) =>
        s.id === active.id
          ? { ...s, running: undefined, endedAt: new Date().toISOString() }
          : s,
      ),
    };
  });
}
export function captureResearchSessionId(): string | null {
  try {
    return activeResearchSession(readResearch())?.id ?? null;
  } catch {
    return null;
  }
}
export function deleteResearchSession(sessionId: string): ResearchState {
  return updateResearch((state) => ({
    ...state,
    activeId: state.activeId === sessionId ? undefined : state.activeId,
    sessions: state.sessions.filter((s) => s.id !== sessionId),
  }));
}
export function recordResearchEvent(
  name: ResearchEventName,
  metadata: ResearchMetadata = {},
  expectedSessionId?: string | null,
): boolean {
  try {
    const state = readResearch();
    const current = activeResearchSession(state);
    if (
      !current ||
      expectedSessionId === null ||
      (expectedSessionId !== undefined && current.id !== expectedSessionId)
    )
      return false;
    const safeMetadata = researchMetadataSchema.parse(metadata);
    updateActiveResearch(
      (session) => ({
        ...session,
        events: [
          ...session.events,
          { at: new Date().toISOString(), name, metadata: safeMetadata },
        ],
      }),
      current.id,
    );
    return true;
  } catch {
    lastRecordingError = "research_recording_failed";
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event(RESEARCH_CHANGED));
    return false;
  }
}
export function researchSummary(sessions: ResearchSession[]) {
  return (["pilot", "main"] as const).map((phase) => {
    const selected = sessions.filter((s) => s.phase === phase);
    const observations = selected.flatMap((s) => s.observations);
    return {
      phase,
      sessions: selected.length,
      participantCodes: new Set(selected.map((s) => s.participant)).size,
      attempts: observations.length,
      successes: observations.filter((o) => o.outcome === "success").length,
      successRate: observations.length
        ? (observations.filter((o) => o.outcome === "success").length /
            observations.length) *
          100
        : null,
      meanSeconds: observations.length
        ? observations.reduce((sum, o) => sum + o.elapsedMs / 1000, 0) /
          observations.length
        : null,
    };
  });
}
export function researchCsvCell(value: unknown): string {
  const text = String(value ?? "");
  // Quoting alone does not prevent spreadsheet formula evaluation.
  const leading = Array.from(text).find(
    (character) => character.charCodeAt(0) > 31 && !/\s/u.test(character),
  );
  const safe = leading && "=+@-".includes(leading) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportResearchCsv(state: ResearchState): string {
  const rows: unknown[][] = [
    [
      "record_type",
      "session_id",
      "participant_code",
      "phase",
      "release",
      "consented_at",
      "ended_at",
      "task_or_event",
      "started_at",
      "finished_at",
      "elapsed_seconds",
      "outcome",
      "assistance_count",
      "error_count",
      "note",
      "usefulness_1_5",
      "clarity_1_5",
      "ease_1_5",
      "result_count",
      "cached",
      "timing_basis",
      "target",
    ],
  ];
  for (const s of state.sessions) {
    const base = [
      s.id,
      s.participant,
      s.phase,
      s.release,
      s.consentedAt,
      s.endedAt ?? "",
    ];
    rows.push(["session", ...base]);
    for (const o of s.observations)
      rows.push([
        "task",
        ...base,
        o.task,
        o.startedAt,
        o.finishedAt,
        o.elapsedMs / 1000,
        o.outcome,
        o.assistance,
        o.errors,
        o.note,
        "",
        "",
        "",
        "",
        "",
        o.timingBasis,
      ]);
    for (const e of s.events)
      rows.push([
        "event",
        ...base,
        e.name,
        e.at,
        "",
        e.metadata.elapsedMs === undefined ? "" : e.metadata.elapsedMs / 1000,
        e.metadata.outcome ?? e.metadata.status ?? "",
        "",
        "",
        "",
        "",
        "",
        "",
        e.metadata.resultCount ?? "",
        e.metadata.cached ?? "",
        "",
        e.metadata.target ?? "",
      ]);
    if (s.feedback)
      rows.push([
        "feedback",
        ...base,
        "",
        s.feedback.at,
        "",
        "",
        "",
        "",
        "",
        s.feedback.comment,
        s.feedback.usefulness,
        s.feedback.clarity,
        s.feedback.ease,
      ]);
  }
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        Array.from({ length: 22 }, (_, i) => researchCsvCell(row[i])).join(","),
      )
      .join("\r\n")
  );
}
export function downloadResearch(state: ResearchState, format: "csv" | "json") {
  const validated = researchStateSchema.parse(state);
  const data =
    format === "csv"
      ? exportResearchCsv(validated)
      : JSON.stringify(validated, null, 2);
  const url = URL.createObjectURL(
    new Blob([data], {
      type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rebuild-research-${new Date().toISOString().slice(0, 10)}.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
