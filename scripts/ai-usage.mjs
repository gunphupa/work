// Run on the server with QUOTA_DB set to its persistent quota database.
// Read-only operational aggregates; no prompts, materials, photos or users.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import process from "node:process";
import console from "node:console";

const path = process.env.QUOTA_DB;
if (!path || !existsSync(path)) {
  console.error("Set QUOTA_DB to the existing persistent quota database.");
  process.exitCode = 1;
} else {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `SELECT day,mode,outcome,requests,duration_ms,max_duration_ms
         FROM ai_usage WHERE day >= ? ORDER BY day,mode,outcome`,
      )
      .all(Math.floor(Date.now() / 86400000) - 89);
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          period: "last 90 UTC days",
          note: "Operational request counts, not participant observations or currency charges. Cache requests do not call the AI provider.",
          records: rows.map((row) => ({
            date: new Date(row.day * 86400000).toISOString().slice(0, 10),
            mode: row.mode,
            outcome: row.outcome,
            requests: row.requests,
            totalDurationMs: row.duration_ms,
            meanDurationMs: Math.round(row.duration_ms / row.requests),
            maxDurationMs: row.max_duration_ms,
          })),
        },
        null,
        2,
      ),
    );
  } catch {
    console.error(
      "Could not read AI usage. Deploy the current server and verify the database path and permissions.",
    );
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
