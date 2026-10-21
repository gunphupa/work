import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import console from "node:console";

const source = process.env.QUOTA_DB;
const destination = process.argv[2];
if (!source || !destination) {
  console.error(
    "Usage: QUOTA_DB=/mounted/path/quota.sqlite node scripts/backup-quota.mjs /mounted/path/backups/quota-date.sqlite",
  );
  process.exit(1);
}
const from = resolve(source),
  to = resolve(destination);
if (!existsSync(from) || from === to || existsSync(to)) {
  console.error(
    "Source must exist and destination must be a new, separate file. No files changed.",
  );
  process.exit(1);
}
mkdirSync(dirname(to), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(from, { readOnly: true });
const previousMask = process.umask(0o077);
try {
  // SQLite's online backup includes committed WAL content, unlike copying the main file alone.
  await backup(db, to);
  chmodSync(to, 0o600);
  const check = new DatabaseSync(to, { readOnly: true });
  try {
    const row = check.prepare("PRAGMA integrity_check").get();
    if (row.integrity_check !== "ok")
      throw Error("Backup integrity check failed");
  } finally {
    check.close();
  }
  console.log(
    "SQLite backup created and integrity check passed. Keep it private: it contains session tokens and quota state.",
  );
} finally {
  db.close();
  process.umask(previousMask);
}
