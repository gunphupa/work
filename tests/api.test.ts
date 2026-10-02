import { afterEach, describe, it, expect } from "vitest";
import { createApp } from "../server/app";
import { Quotas } from "../server/quota";
import type { Provider } from "../server/ai";
import type { Server } from "node:http";
import sharp from "sharp";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const fixture = { reply: "คำตอบทดสอบเท่านั้น", candidates: [] };
let quota: Quotas | undefined, server: Server | undefined, base: string;
async function setup(provider?: Provider, globalLimit = 10, timeoutMs = 1000) {
  quota = new Quotas(":memory:");
  const app = createApp({
    quota,
    provider,
    origin: "http://rebuild.test",
    globalLimit,
    timeoutMs,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
}
async function session() {
  const res = await fetch(base + "/api/session");
  const body = (await res.json()) as { csrf: string };
  return {
    "Content-Type": "application/json",
    origin: "http://rebuild.test",
    cookie: res.headers.get("set-cookie")!.split(";")[0],
    "x-csrf-token": body.csrf,
  };
}
async function post(body: unknown, headers: Record<string, string>) {
  return fetch(base + "/api/ai", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
afterEach(async () => {
  const current = server;
  if (current) await new Promise<void>((r) => current.close(() => r()));
  quota?.close();
  quota = undefined;
  server = undefined;
});
describe("AI API boundaries (test providers; no live AI claims)", () => {
  it("forwards the selected language and rejects unsupported language values", async () => {
    const languages: string[] = [];
    await setup(async (input) => {
      languages.push(input.language);
      return fixture;
    });
    const headers = await session();
    expect(
      (
        await post(
          { mode: "help", text: "Explain this step", language: "en" },
          headers,
        )
      ).status,
    ).toBe(200);
    expect(
      (await post({ mode: "help", text: "ช่วยอธิบาย" }, headers)).status,
    ).toBe(200);
    expect(
      (
        await post(
          { mode: "help", text: "Explain", language: "unsupported" },
          headers,
        )
      ).status,
    ).toBe(400);
    expect(languages).toEqual(["en", "th"]);
  });
  it("returns honest unavailable status without a key", async () => {
    await setup();
    const res = await post({ mode: "inventory", text: "LED" }, await session());
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain(
      "ยังไม่ได้เชื่อมต่อ",
    );
  });
  it("rejects a foreign origin and missing CSRF before calling the provider", async () => {
    let calls = 0;
    await setup(async () => {
      calls++;
      return fixture;
    });
    const headers = await session();
    expect(
      (
        await post(
          { mode: "inventory", text: "LED" },
          { ...headers, origin: "https://attacker.test" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await post(
          { mode: "inventory", text: "LED" },
          { ...headers, "x-csrf-token": "" },
        )
      ).status,
    ).toBe(403);
    expect(calls).toBe(0);
  });
  it("validates structured output and returns provider failures without fabricated results", async () => {
    await setup(async () => ({ garbage: true }) as never);
    const response = await post(
      { mode: "inventory", text: "LED" },
      await session(),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty("candidates");
  });
  it("applies a persistent global quota across guests", async () => {
    await setup(async () => fixture, 1);
    const headers = await session();
    expect(
      (await post({ mode: "inventory", text: "LED" }, headers)).status,
    ).toBe(200);
    expect(
      (await post({ mode: "help", text: "help" }, await session())).status,
    ).toBe(429);
  });
  it("rejects spoofed image bytes and missing consent", async () => {
    await setup(async () => fixture);
    const headers = await session();
    expect(
      (
        await post(
          {
            mode: "photo",
            imageConsent: true,
            images: [
              {
                mime: "image/png",
                data: Buffer.from("<script>alert(1)</script>").toString(
                  "base64",
                ),
              },
            ],
          },
          headers,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          { mode: "photo", images: [{ mime: "image/png", data: "AA==" }] },
          headers,
        )
      ).status,
    ).toBe(400);
  });
  it("decodes, strips, and forwards actual image pixels to the provider", async () => {
    let mime = "",
      size = 0;
    await setup(async (input) => {
      mime = input.images[0].mime;
      size = Buffer.from(input.images[0].data, "base64").length;
      return fixture;
    });
    const bytes = await sharp({
      create: { width: 30, height: 20, channels: 3, background: "green" },
    })
      .png()
      .toBuffer();
    const r = await post(
      {
        mode: "photo",
        imageConsent: true,
        images: [{ mime: "image/png", data: bytes.toString("base64") }],
      },
      await session(),
    );
    expect(r.status).toBe(200);
    expect(mime).toBe("image/webp");
    expect(size).toBeGreaterThan(0);
  });
  it("cancels a slow provider and reports timeout", async () => {
    await setup(
      (_input, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(Error("timeout"))),
        ),
      10,
      40,
    );
    const r = await post({ mode: "help", text: "question" }, await session());
    expect(r.status).toBe(504);
  });
  it("limits payloads and returns security headers without secrets", async () => {
    await setup();
    const h = await fetch(base + "/api/health");
    expect(h.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(await h.json()).toEqual({
      ok: true,
      aiConfigured: false,
      catalogueVersion: 1,
    });
    expect(
      (
        await post(
          { mode: "inventory", text: "x".repeat(5000) },
          await session(),
        )
      ).status,
    ).toBe(400);
  });
});
describe("quota durability", () => {
  it("retains reservations through database reopen and rejects a batch atomically", () => {
    const dir = mkdtempSync(join(tmpdir(), "rebuild-quota-"));
    const path = join(dir, "db.sqlite");
    let q = new Quotas(path);
    const limits = [{ key: "global", max: 1, expires: Date.now() + 60000 }];
    expect(q.take(limits)).toBe(true);
    q.close();
    q = new Quotas(path);
    expect(
      q.take([
        { key: "guest", max: 1, expires: Date.now() + 60000 },
        ...limits,
      ]),
    ).toBe(false);
    expect(
      q.take([{ key: "guest", max: 1, expires: Date.now() + 60000 }]),
    ).toBe(true);
    q.close();
    rmSync(dir, { recursive: true });
  });
});
