import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
let db: PGlite;
let migration: string;
const owner = "10000000-0000-4000-8000-000000000001";
const take = (id = owner) =>
  db.query<{ allowed: boolean }>(
    "select public.take_community_submission($1) as allowed",
    [id],
  );
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;",
  );
  migration = await readFile(
    new URL("../supabase/posting-limits.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
}, 20000);
beforeEach(async () => {
  await db.exec(
    "reset role; truncate public.community_submission_limits; set role service_role;",
  );
});
afterAll(async () => {
  await db?.close();
});
it("persists the tenth attempt across migration reruns and does not consume global quota on rejection", async () => {
  for (let n = 0; n < 10; n++)
    expect((await take()).rows[0].allowed).toBe(true);
  await db.exec("reset role");
  await db.exec(migration);
  await db.exec("set role service_role");
  expect((await take()).rows[0].allowed).toBe(false);
  expect(
    (
      await db.query<{ attempts: number }>(
        "select attempts from public.community_submission_limits where bucket='global'",
      )
    ).rows[0].attempts,
  ).toBe(10);
});
it("enforces the global cap across different users and queued requests", async () => {
  const ids = Array.from(
    { length: 110 },
    (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  );
  const results = await Promise.all(ids.map((id) => take(id)));
  expect(results.filter((r) => r.rows[0].allowed)).toHaveLength(100);
  expect(
    (
      await db.query(
        "select * from public.community_submission_limits where bucket <> 'global'",
      )
    ).rows,
  ).toHaveLength(100);
});
it("starts a new UTC day and cleans up expired counters", async () => {
  await db.exec(
    "insert into public.community_submission_limits values (((statement_timestamp() at time zone 'UTC')::date - 1),'global',100);",
  );
  expect((await take()).rows[0].allowed).toBe(true);
  expect(
    (
      await db.query(
        "select * from public.community_submission_limits where quota_day < (statement_timestamp() at time zone 'UTC')::date",
      )
    ).rows,
  ).toHaveLength(0);
});
it("denies browser roles both table access and quota RPC execution", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await expect(take()).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select * from public.community_submission_limits"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("delete from public.community_submission_limits"),
    ).rejects.toThrow(/permission denied/);
  }
});
it("rejects a missing verified actor without consuming quota", async () => {
  await expect(
    db.query("select public.take_community_submission(null)"),
  ).rejects.toThrow(/User required/);
  expect(
    (await db.query("select * from public.community_submission_limits")).rows,
  ).toHaveLength(0);
});

it("retains counters when the database engine is closed and reopened", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const folder = await mkdtemp(join(tmpdir(), "rebuild-quota-"));
  let durable = new PGlite(folder);
  try {
    await durable.exec(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
    await durable.exec(migration);
    for (let n = 0; n < 10; n++)
      await durable.query("select public.take_community_submission($1)", [
        owner,
      ]);
    await durable.close();
    durable = new PGlite(folder);
    const result = await durable.query<{ allowed: boolean }>(
      "select public.take_community_submission($1) as allowed",
      [owner],
    );
    expect(result.rows[0].allowed).toBe(false);
  } finally {
    await durable.close();
    await rm(folder, { recursive: true, force: true });
  }
}, 20000);
