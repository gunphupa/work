import { existsSync } from "node:fs";
import express from "express";
import { resolve } from "node:path";
import { Quotas } from "./quota";
import { openAIProvider } from "./ai";
import { createApp } from "./app";
import { communityConfig, supabaseStore } from "./community-store";
if (existsSync(".env")) process.loadEnvFile(".env");
const port = Number(process.env.PORT ?? 3000),
  production = process.env.NODE_ENV === "production";
const origin = process.env.APP_ORIGIN ?? `http://localhost:${port}`;
const community = communityConfig();
if (
  production &&
  community &&
  (!process.env.APP_ORIGIN || !process.env.QUOTA_DB)
)
  throw Error("Public accounts require APP_ORIGIN and a persistent QUOTA_DB.");
if (
  production &&
  process.env.REBUILD_AI_KEY &&
  (!process.env.APP_ORIGIN || !process.env.QUOTA_DB)
)
  throw new Error(
    "Public AI requires APP_ORIGIN and QUOTA_DB on a persistent volume.",
  );
const quota = new Quotas(process.env.QUOTA_DB ?? ".data/quota.sqlite");
function limit(name: string, fallback: number) {
  const v = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Invalid ${name}`);
  return v;
}
const app = createApp({
  quota,
  origin,
  production,
  community: community ? supabaseStore(community) : undefined,
  provider: process.env.REBUILD_AI_KEY
    ? openAIProvider(
        process.env.REBUILD_AI_KEY,
        process.env.REBUILD_AI_MODEL ?? "gpt-4.1-mini",
      )
    : undefined,
  globalLimit: limit("AI_GLOBAL_DAILY", 50),
  guestLimit: limit("AI_GUEST_DAILY", 10),
  ipLimit: limit("AI_IP_DAILY", 15),
});
if (production) {
  app.use(express.static(resolve("dist/client"), { index: false }));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(resolve("dist/client/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, "0.0.0.0", () =>
  console.info(
    `ReBuild listening on port ${port}; AI ${process.env.REBUILD_AI_KEY ? "configured, live validation required" : "not connected"}`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      quota.close();
      process.exit(0);
    }),
  );
