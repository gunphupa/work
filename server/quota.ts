import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHmac, randomBytes } from "node:crypto";
export class Quotas {
  db: DatabaseSync;
  salt: string;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS buckets (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
    this.db
      .prepare("INSERT OR IGNORE INTO settings VALUES (?,?)")
      .run("salt", randomBytes(32).toString("hex"));
    this.salt = (
      this.db.prepare("SELECT value FROM settings WHERE key=?").get("salt") as {
        value: string;
      }
    ).value;
  }
  hash(text: string) {
    return createHmac("sha256", this.salt).update(text).digest("hex");
  }
  take(limits: { key: string; max: number; expires: number }[]): boolean {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM buckets WHERE expires < ?").run(Date.now());
      this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
      for (const l of limits) {
        const r = this.db
          .prepare("SELECT count FROM buckets WHERE key=?")
          .get(l.key) as { count: number } | undefined;
        if ((r?.count ?? 0) >= l.max) {
          this.db.exec("ROLLBACK");
          return false;
        }
      }
      for (const l of limits)
        this.db
          .prepare(
            "INSERT INTO buckets VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
          )
          .run(l.key, l.expires);
      this.db.exec("COMMIT");
      return true;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  session(id?: string) {
    if (!id || !/^[a-f0-9]{64}$/.test(id)) return undefined;
    return this.db
      .prepare("SELECT csrf,expires FROM sessions WHERE id=? AND expires>?")
      .get(id, Date.now()) as { csrf: string; expires: number } | undefined;
  }
  createSession() {
    const id = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(id, csrf, Date.now() + 86400000);
    return { id, csrf };
  }
  close() {
    this.db.close();
  }
}
