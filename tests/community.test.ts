import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import sharp from "sharp";
import { createApp } from "../server/app";
import { Quotas } from "../server/quota";
import {
  communityConfig,
  type CommunityStore,
} from "../server/community-store";
import type { Entry } from "../src/domain/community";

const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const admin = "10000000-0000-4000-8000-000000000003";
const id = "20000000-0000-4000-8000-000000000001";
const origin = "http://rebuild.test";
let server: Server | undefined,
  quota: Quotas | undefined,
  base = "";
let entries: Entry[] = [];
let photoBytes: Buffer | undefined;
let uploads = 0;
const takeSubmission = vi.fn<(id: string) => Promise<boolean>>();
const fixture = (extra: Partial<Entry> = {}): Entry => ({
  id,
  user_id: owner,
  target: "drawer-dividers",
  kind: "comment",
  name: "Maker",
  body: "I built this from a clean cardboard box.",
  rating: null,
  difficulty: null,
  outcome: null,
  photo_path: null,
  status: "pending",
  moderation_note: "Private author feedback",
  created_at: new Date().toISOString(),
  ...extra,
});
async function setup(enabled = true) {
  entries = [];
  photoBytes = undefined;
  uploads = 0;
  const attempts = new Map<string, number>();
  takeSubmission.mockReset().mockImplementation(async (id) => {
    const count = attempts.get(id) ?? 0;
    if (count >= 10) return false;
    attempts.set(id, count + 1);
    return true;
  });
  const store: CommunityStore = {
    takeSubmission,
    config: {
      url: "https://fixture.supabase.co",
      publishableKey: "test-public-key",
    },
    user: async (token) => ({ owner, other, admin })[token] ?? null,
    moderator: async (user) => user === admin,
    list: async (f) =>
      entries
        .filter(
          (e) =>
            (!f.target || e.target === f.target) &&
            (!f.kind || e.kind === f.kind) &&
            (!f.owner || e.user_id === f.owner) &&
            (!f.status || e.status === f.status),
        )
        .slice(f.offset, f.offset + 20),
    get: async (value) => entries.find((e) => e.id === value) ?? null,
    insert: async (e) => {
      if (
        e.kind === "review" &&
        entries.some(
          (old) =>
            old.user_id === e.user_id &&
            old.target === e.target &&
            old.kind === "review",
        )
      )
        throw { code: "23505" };
      entries.push({
        ...e,
        created_at: new Date().toISOString(),
        moderation_note: "",
      });
    },
    moderate: async (id, _actor, status, note) => {
      const entry = entries.find((e) => e.id === id)!;
      entry.status = status;
      entry.moderation_note = note;
    },
    remove: async (id) => {
      entries = entries.filter((e) => e.id !== id);
    },
    upload: async (_path, bytes) => {
      uploads++;
      photoBytes = bytes;
    },
    photo: async () => photoBytes ?? Buffer.from("fixture"),
    removePhoto: async () => {
      photoBytes = undefined;
    },
  };
  quota = new Quotas(":memory:");
  const app = createApp({
    quota,
    origin,
    production: true,
    community: enabled ? store : undefined,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server!.address() as { port: number }).port}/api/community`;
}
async function call(
  path: string,
  method = "GET",
  token?: string,
  body?: unknown,
  site = origin,
) {
  return fetch(base + path, {
    method,
    headers: {
      origin: site,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const submission = {
  target: "drawer-dividers",
  kind: "comment",
  name: "Maker",
  body: "I built this with clean packaging.",
  guidelines: true,
};
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  quota?.close();
  quota = undefined;
  server = undefined;
  vi.unstubAllEnvs();
});
describe("Community API (verified-identity and storage test adapters)", () => {
  it("stays honestly unavailable without configuration", async () => {
    await setup(false);
    expect(await (await call("/config")).json()).toEqual({ enabled: false });
    expect((await call("/entries?target=website&kind=review")).status).toBe(
      503,
    );
  });
  it("exposes only public configuration and restricts CSP to the configured project", async () => {
    await setup();
    const response = await call("/config");
    expect(await response.json()).toEqual({
      enabled: true,
      url: "https://fixture.supabase.co",
      publishableKey: "test-public-key",
    });
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "connect-src 'self' https://fixture.supabase.co;",
    );
  });
  it("returns only approved posts without owner identifiers or moderator notes", async () => {
    await setup();
    entries.push(
      fixture(),
      fixture({ id: other, status: "approved", photo_path: "private.jpg" }),
    );
    const { entries: visible } = await (
      await call("/entries?target=drawer-dividers&kind=comment")
    ).json();
    expect(visible).toHaveLength(1);
    expect(visible[0].moderation_note).toBe("");
    expect(visible[0].hasPhoto).toBe(true);
    expect(visible[0]).not.toHaveProperty("user_id");
    expect(visible[0]).not.toHaveProperty("photo_path");
  });
  it("requires verified identity and a same-origin request for submitting", async () => {
    await setup();
    expect((await call("/entries", "POST", undefined, submission)).status).toBe(
      401,
    );
    expect((await call("/entries", "POST", "invalid", submission)).status).toBe(
      401,
    );
    expect(
      (
        await call(
          "/entries",
          "POST",
          "owner",
          submission,
          "https://other.test",
        )
      ).status,
    ).toBe(403);
    expect(entries).toHaveLength(0);
  });
  it("rejects status/owner injection and always inserts an authenticated pending entry", async () => {
    await setup();
    expect(
      (
        await call("/entries", "POST", "owner", {
          ...submission,
          status: "approved",
          user_id: admin,
        })
      ).status,
    ).toBe(400);
    const response = await call("/entries", "POST", "owner", submission);
    expect(response.status).toBe(201);
    expect(entries[0]).toMatchObject({
      user_id: owner,
      status: "pending",
      target: "drawer-dividers",
    });
    expect(
      (
        await (
          await call("/entries?target=drawer-dividers&kind=comment")
        ).json()
      ).entries,
    ).toHaveLength(0);
  });
  it("validates known targets, guideline consent, rating range and site-only review fields", async () => {
    await setup();
    for (const change of [
      { target: "missing-project" },
      { guidelines: false },
      { rating: 3 },
      { kind: "review", rating: 6 },
      { kind: "review", target: "website", rating: 4, difficulty: "easy" },
    ])
      expect(
        (await call("/entries", "POST", "owner", { ...submission, ...change }))
          .status,
      ).toBe(400);
  });
  it("keeps project reviews and site reviews distinct and enforces one review per account/target", async () => {
    await setup();
    expect(
      (
        await call("/entries", "POST", "owner", {
          ...submission,
          kind: "review",
          rating: 1,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("/entries", "POST", "owner", {
          ...submission,
          kind: "review",
          rating: 5,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call("/entries", "POST", "owner", {
          ...submission,
          target: "website",
          kind: "review",
          rating: 2,
        })
      ).status,
    ).toBe(201);
    expect(entries.map((e) => e.rating)).toEqual([1, 2]);
  });
  it("lets authors read only their submissions; ordinary users cannot open or use moderation", async () => {
    await setup();
    entries.push(fixture(), fixture({ id: other, user_id: other }));
    const mine = await (await call("/mine", "GET", "owner")).json();
    expect(mine.entries).toHaveLength(1);
    expect(mine.entries[0].moderation_note).toBe("Private author feedback");
    expect((await call("/queue", "GET", "owner")).status).toBe(403);
    expect(
      (await call(`/entries/${id}`, "PATCH", "owner", { status: "approved" }))
        .status,
    ).toBe(403);
    expect(entries[0].status).toBe("pending");
  });
  it("allows approval then unpublishing, while preserving honest low reviews", async () => {
    await setup();
    entries.push(fixture({ kind: "review", rating: 1 }));
    expect(
      (
        await call(`/entries/${id}`, "PATCH", "admin", {
          status: "approved",
          note: "Constructive feedback",
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await call("/entries?target=drawer-dividers&kind=review")).json())
        .entries[0].rating,
    ).toBe(1);
    expect(
      (
        await call(`/entries/${id}`, "PATCH", "admin", {
          status: "rejected",
          note: "Personal details in photo",
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await call("/entries?target=drawer-dividers&kind=review")).json())
        .entries,
    ).toHaveLength(0);
  });
  it("keeps pending and rejected photos private and removes access after unpublishing", async () => {
    await setup();
    entries.push(fixture({ photo_path: "private.jpg" }));
    expect((await call(`/photos/${id}`)).status).toBe(401);
    expect((await call(`/photos/${id}`, "GET", "other")).status).toBe(404);
    expect((await call(`/photos/${id}`, "GET", "owner")).status).toBe(200);
    expect((await call(`/photos/${id}`, "GET", "admin")).status).toBe(200);
    entries[0].status = "approved";
    const publicPhoto = await call(`/photos/${id}`);
    expect(publicPhoto.headers.get("Cache-Control")).toBe("no-store");
    expect(publicPhoto.status).toBe(200);
    entries[0].status = "rejected";
    expect((await call(`/photos/${id}`)).status).toBe(401);
  });
  it("decodes actual photo bytes, strips metadata and rejects SVG/fake images before upload", async () => {
    await setup();
    const input = await sharp({
      create: { width: 1500, height: 400, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    expect(
      (
        await call("/entries", "POST", "owner", {
          ...submission,
          photo: input.toString("base64"),
        })
      ).status,
    ).toBe(201);
    const actual = await sharp(photoBytes!).metadata();
    expect(actual.format).toBe("jpeg");
    expect(actual.width).toBe(1200);
    expect(actual.exif).toBeUndefined();
    expect(entries[0].photo_path).toMatch(new RegExp(`^${owner}/.*\\.jpg$`));
    for (const data of ["not-an-image", "<svg><script>alert(1)</script></svg>"])
      expect(
        (
          await call("/entries", "POST", "owner", {
            ...submission,
            photo: Buffer.from(data).toString("base64"),
          })
        ).status,
      ).toBe(400);
    expect(uploads).toBe(1);
  });
  it("rejects deleting another person’s entry and allows its author to delete it", async () => {
    await setup();
    entries.push(fixture());
    expect((await call(`/entries/${id}`, "DELETE", "other")).status).toBe(404);
    expect(entries).toHaveLength(1);
    expect((await call(`/entries/${id}`, "DELETE", "owner")).status).toBe(204);
    expect(entries).toHaveLength(0);
  });
  it("limits submissions per verified account", async () => {
    await setup();
    for (let i = 0; i < 10; i++)
      expect((await call("/entries", "POST", "owner", submission)).status).toBe(
        201,
      );
    expect((await call("/entries", "POST", "owner", submission)).status).toBe(
      429,
    );
    expect(entries).toHaveLength(10);
  });
  it("fails closed when durable quota storage is unavailable", async () => {
    await setup();
    takeSubmission.mockRejectedValueOnce(Error("database unavailable"));
    expect((await call("/entries", "POST", "owner", submission)).status).toBe(
      502,
    );
    expect(entries).toHaveLength(0);
    expect(uploads).toBe(0);
    expect(takeSubmission).toHaveBeenCalledWith(owner);
  });
  it("rejects malformed IDs and invalid page offsets", async () => {
    await setup();
    expect((await call("/entries/not-an-id", "DELETE", "owner")).status).toBe(
      400,
    );
    expect(
      (await call("/entries?target=website&kind=review&offset=-1")).status,
    ).toBe(400);
  });
  it("rejects unsafe configured origins instead of inserting them into CSP", () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
    for (const url of [
      "http://example.supabase.co",
      "https://example.org",
      "https://example.supabase.co/?anything",
      "https://example.supabase.co:444",
      "https://user@example.supabase.co",
    ]) {
      vi.stubEnv("SUPABASE_URL", url);
      expect(() => communityConfig()).toThrow();
    }
  });
  it("never exposes an elevated key as the browser's public key", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_secret_test");
    expect(() => communityConfig()).toThrow(/never a service key/);
    const token = (role: string) =>
      `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", token("service_role"));
    expect(() => communityConfig()).toThrow(/never a service key/);
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", token("anon"));
    expect(communityConfig()?.publishableKey).toBe(token("anon"));
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(communityConfig()?.url).toBe("https://example.supabase.co");
  });
});
