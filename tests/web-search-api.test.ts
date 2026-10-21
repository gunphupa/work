import { afterEach, describe, it, expect } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../server/app";
import { Quotas } from "../server/quota";
import type { WebSearchProvider } from "../server/web-projects";
import { webRequest, webResult } from "./web-fixtures";
let server: Server | undefined, quota: Quotas | undefined, base: string;
async function setup(
  webSearchProvider?: WebSearchProvider,
  globalLimit = 10,
  searchTimeoutMs = 1000,
) {
  quota = new Quotas(":memory:");
  const app = createApp({
    quota,
    origin: "http://rebuild.test",
    webSearchProvider,
    globalLimit,
    searchTimeoutMs,
    provider: async () => ({ reply: "fixture", candidates: [] }),
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
}
async function headers() {
  const response = await fetch(base + "/api/session");
  const { csrf } = await response.json();
  return {
    "Content-Type": "application/json",
    origin: "http://rebuild.test",
    cookie: response.headers.get("set-cookie")!.split(";")[0],
    "x-csrf-token": csrf,
  };
}
const post = (
  body: unknown,
  h: Record<string, string>,
  path = "/api/projects/search",
) =>
  fetch(base + path, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
afterEach(async () => {
  await new Promise<void>((resolve) =>
    server ? server.close(() => resolve()) : resolve(),
  );
  quota?.close();
  server = undefined;
  quota = undefined;
});
describe("external search API", () => {
  it("requires same-origin session/CSRF before paid search", async () => {
    let calls = 0;
    await setup(async () => {
      calls++;
      return webResult;
    });
    const h = await headers();
    expect(
      (await post(webRequest, { ...h, origin: "https://attacker.org" })).status,
    ).toBe(403);
    expect(
      (await post(webRequest, { ...h, "x-csrf-token": "wrong" })).status,
    ).toBe(403);
    expect(calls).toBe(0);
  });
  it("validates before calling the provider and strips photos/notes on the server", async () => {
    const received: unknown[] = [];
    await setup(async (input) => {
      received.push(input);
      return webResult;
    });
    const h = await headers();
    expect((await post({ query: "" }, h)).status).toBe(400);
    const body = {
      ...webRequest,
      materials: [
        {
          ...webRequest.materials[0],
          photo: "private photo",
          notes: "private note",
        },
      ],
    };
    expect((await post(body, h)).status).toBe(200);
    expect(JSON.stringify(received)).not.toContain("private");
  });
  it("shares persistent daily cost limits with other AI features", async () => {
    await setup(async () => webResult, 1);
    const h = await headers();
    expect((await post(webRequest, h)).status).toBe(200);
    expect(
      (await post({ mode: "inventory", text: "paper" }, h, "/api/ai")).status,
    ).toBe(429);
    expect((await post(webRequest, await headers())).status).toBe(429);
  });
  it("reports unconfigured search separately from configured inventory AI", async () => {
    await setup();
    const health = await (await fetch(base + "/api/health")).json();
    expect(health).toMatchObject({
      aiConfigured: true,
      webSearchConfigured: false,
    });
    expect((await post(webRequest, await headers())).status).toBe(503);
  });
  it("returns timeout without fabricated cached results", async () => {
    await setup(
      (_input, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(Error("timeout"))),
        ),
      10,
      40,
    );
    const r = await post(webRequest, await headers());
    expect(r.status).toBe(504);
    expect(await r.json()).not.toHaveProperty("projects");
  });
  it("rejects malformed provider results and unsafe source URLs", async () => {
    await setup(async () => ({
      ...webResult,
      sources: [{ id: "s1", title: "Unsafe", url: "javascript:alert(1)" }],
    }));
    expect((await post(webRequest, await headers())).status).toBe(502);
  });
});
