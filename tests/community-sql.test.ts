import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000001";
const moderator = "10000000-0000-4000-8000-000000000002";
const entry = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  // Supabase-managed schemas are fixtures here; the actual project migration
  // and PostgreSQL permission checks run unchanged in the local engine.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text);
    alter table storage.objects enable row level security;
    grant usage on schema public,storage to anon,authenticated,service_role;
    grant all on storage.objects to anon,authenticated,service_role;
    create policy other_permissive_policy on storage.objects for all to anon,authenticated using(true) with check(true);
    insert into auth.users values('${owner}'),('${moderator}');`);
  const migration = await readFile(
    new URL("../supabase/community.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  await db.query("insert into public.community_moderators values($1)", [
    moderator,
  ]);
  await db.query(
    `insert into public.community_entries(id,user_id,target,kind,name,body,rating) values($1,$2,'website','review','Maker','An honest low-rated review.',1)`,
    [entry, owner],
  );
  await db.query(`insert into storage.objects values($1,'community-photos')`, [
    entry,
  ]);
}, 20000);
afterAll(async () => {
  await db?.close();
});
describe("Community migration on local PostgreSQL (Supabase schemas simulated)", () => {
  it("is repeatable and creates a private bucket and pending submissions", async () => {
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.community_entries",
        )
      ).rows[0].status,
    ).toBe("pending");
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='community-photos'",
        )
      ).rows[0].public,
    ).toBe(false);
  });
  it("denies direct table access and role escalation from browser roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await expect(
          db.query("select * from public.community_entries"),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query("insert into public.community_moderators values($1)", [
            owner,
          ]),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query("select public.moderate_community_entry($1,$2,$3,$4)", [
            entry,
            moderator,
            "approved",
            "",
          ]),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("reset role");
      }
    }
  });
  it("blocks private-photo reads and writes even with an unrelated permissive policy", async () => {
    await db.exec("set role authenticated");
    try {
      expect((await db.query("select * from storage.objects")).rows).toEqual(
        [],
      );
      await expect(
        db.query("insert into storage.objects values($1,'community-photos')", [
          owner,
        ]),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("requires an appointed moderator even for the service RPC and records decisions atomically", async () => {
    await db.exec("set role service_role");
    try {
      await expect(
        db.query("select public.moderate_community_entry($1,$2,$3,$4)", [
          entry,
          owner,
          "approved",
          "",
        ]),
      ).rejects.toThrow(/Moderator required/);
      await db.query("select public.moderate_community_entry($1,$2,$3,$4)", [
        entry,
        moderator,
        "approved",
        "Honest feedback",
      ]);
      expect(
        (
          await db.query<{ status: string }>(
            "select status from public.community_entries where id=$1",
            [entry],
          )
        ).rows[0].status,
      ).toBe("approved");
      expect(
        (await db.query("select * from public.community_decisions")).rows,
      ).toHaveLength(1);
      await expect(
        db.query("select public.moderate_community_entry($1,$2,$3,$4)", [
          entry,
          moderator,
          "approved",
          "x".repeat(501),
        ]),
      ).rejects.toThrow();
      expect(
        (await db.query("select * from public.community_decisions")).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("reset role");
    }
  });
  it("enforces one review per user/target and valid photo ownership in the database", async () => {
    await expect(
      db.query(
        `insert into public.community_entries(id,user_id,target,kind,name,body,rating) values($1,$2,'website','review','Maker','Second review of same site.',5)`,
        [moderator, owner],
      ),
    ).rejects.toThrow(/unique constraint/);
    await expect(
      db.query(
        `insert into public.community_entries(id,user_id,target,kind,name,body,photo_path) values($1,$2,'drawer-dividers','comment','Maker','A photo of my project.','someone-else/file.jpg')`,
        [moderator, owner],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
