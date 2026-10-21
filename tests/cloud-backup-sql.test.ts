import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const backup = { version: 1, inventory: [], builds: [] };
type Metadata = { revision: string; updated_at: string };
let revision: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values('${owner}'),('${other}');`);
  const migration = await readFile(
    new URL("../supabase/private-backups.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
}, 20000);
afterAll(async () => {
  await db?.close();
});

async function asUser<T>(id: string, run: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}
async function save(
  expected: string | null,
  payload: unknown = backup,
  actor = owner,
) {
  return (
    await db.query<Metadata>(
      "select * from public.save_rebuild_backup($1::uuid,$2::jsonb,$3::uuid)",
      [actor, JSON.stringify(payload), expected],
    )
  ).rows[0];
}

describe("private account backup migration on local PostgreSQL", () => {
  it("denies anonymous access and direct authenticated writes", async () => {
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select * from public.rebuild_private_backups"),
      ).rejects.toThrow(/permission denied/);
      await expect(save(null)).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select public.delete_rebuild_backup(null,null)"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await asUser(owner, async () => {
      await expect(
        db.query(
          "insert into public.rebuild_private_backups(user_id,payload) values($1,$2::jsonb)",
          [owner, JSON.stringify(backup)],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("delete from public.rebuild_private_backups"),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("creates one private snapshot and prevents overwriting without the current revision", async () => {
    await asUser(owner, async () => {
      const saved = await save(null);
      revision = saved.revision;
      expect(revision).toMatch(/^[\da-f-]{36}$/);
      expect(
        (await db.query("select * from public.rebuild_private_backups")).rows,
      ).toHaveLength(1);
      await expect(save(null)).rejects.toThrow(/Backup changed/);
      const updated = await save(revision);
      expect(updated.revision).not.toBe(revision);
      await expect(save(revision)).rejects.toThrow(/Backup changed/);
      await expect(
        db.query("select public.delete_rebuild_backup($1,$2)", [
          owner,
          revision,
        ]),
      ).rejects.toThrow(/Backup changed/);
      revision = updated.revision;
    });
  });
  it("isolates users even with another permissive read policy", async () => {
    await db.exec(
      "create policy accidental_read_all on public.rebuild_private_backups for select to authenticated using(true)",
    );
    await asUser(other, async () => {
      expect(
        (await db.query("select * from public.rebuild_private_backups")).rows,
      ).toEqual([]);
      await expect(save(revision, backup, other)).rejects.toThrow(
        /Backup changed/,
      );
      await expect(
        db.query("select public.delete_rebuild_backup($1,$2)", [
          other,
          revision,
        ]),
      ).rejects.toThrow(/Backup changed/);
      await save(null, backup, other);
      expect(
        (
          await db.query<{ user_id: string }>(
            "select user_id from public.rebuild_private_backups",
          )
        ).rows,
      ).toEqual([{ user_id: other }]);
    });
  });
  it("binds the click's account identity even if the request is sent after an account switch", async () => {
    await asUser(other, async () => {
      await expect(save(null, backup, owner)).rejects.toThrow(
        /Account changed/,
      );
      await expect(save(revision, backup, owner)).rejects.toThrow(
        /Account changed/,
      );
      await expect(
        db.query("select public.delete_rebuild_backup($1,$2)", [
          owner,
          revision,
        ]),
      ).rejects.toThrow(/Account changed/);
    });
  });
  it("rejects oversized, malformed, excessive-count and missing-field backups", async () => {
    await asUser(owner, async () => {
      for (const invalid of [
        null,
        {},
        { version: 1, inventory: [], builds: "wrong" },
        { ...backup, research: [] },
        { ...backup, inventory: Array(501).fill({}) },
        { ...backup, inventory: [{ notes: "ก".repeat(700000) }] },
      ]) {
        await expect(save(revision, invalid)).rejects.toThrow();
      }
      expect(
        (
          await db.query<{ revision: string }>(
            "select revision from public.rebuild_private_backups",
          )
        ).rows[0].revision,
      ).toBe(revision);
    });
  });
  it("requires authenticated identity and deletes only the matching owner revision", async () => {
    await asUser("", async () => {
      await expect(save(null)).rejects.toThrow(/Sign in required/);
    });
    await asUser(owner, async () => {
      expect(
        (
          await db.query<{ deleted: boolean }>(
            "select public.delete_rebuild_backup($1,$2) as deleted",
            [owner, revision],
          )
        ).rows[0].deleted,
      ).toBe(true);
      expect(
        (await db.query("select * from public.rebuild_private_backups")).rows,
      ).toHaveLength(0);
      // A removed snapshot cannot be recreated by replaying a stale revision.
      await expect(save(revision)).rejects.toThrow(/Backup changed/);
    });
  });
});
