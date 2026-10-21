import express from "express";
import type { ErrorRequestHandler } from "express";
import { Quotas } from "./quota";
import { SearchCache } from "./search-cache";
import { communityRouter } from "./community";
import type { CommunityStore } from "./community-store";
import type { WebSearchProvider } from "./web-projects";
import {
  webSearchRequestSchema,
  webSearchResultSchema,
} from "../src/domain/web-projects";
import {
  requestSchema,
  sanitizeAIAnswer,
  normalizeImages,
  type Provider,
} from "./ai";
export function createApp(options: {
  quota: Quotas;
  provider?: Provider;
  webSearchProvider?: WebSearchProvider;
  origin: string;
  production?: boolean;
  globalLimit?: number;
  guestLimit?: number;
  ipLimit?: number;
  searchDailyLimit?: number;
  searchCacheTtlMs?: number;
  aiEnabled?: boolean;
  timeoutMs?: number;
  searchTimeoutMs?: number;
  community?: CommunityStore;
}) {
  const app = express();
  const aiEnabled = options.aiEnabled !== false;
  const searchCache = new SearchCache(options.searchCacheTtlMs);
  const pendingSearches = new Set<string>();
  const trackUsage: Quotas["recordUsage"] = (...args) => {
    try {
      options.quota.recordUsage(...args);
    } catch {
      // Telemetry must not replace an otherwise valid result or expose errors.
      console.error(JSON.stringify({ event: "ai_usage_write_failed" }));
    }
  };
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'" +
        (options.production ? "" : " 'unsafe-inline'") +
        "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'" +
        (options.community ? ` ${options.community.config.url}` : "") +
        (options.production ? "" : " ws:") +
        "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      aiConfigured: aiEnabled && !!options.provider,
      webSearchConfigured: aiEnabled && !!options.webSearchProvider,
      catalogueVersion: 1,
      communityConfigured: !!options.community,
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 12),
    }),
  );
  app.use(
    "/api/community",
    communityRouter(options.community, options.quota, options.origin),
  );
  const cookie = (header?: string) =>
    header
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("rebuild_session="))
      ?.slice(16);
  app.get("/api/session", (req, res) => {
    const id = cookie(req.headers.cookie),
      session = options.quota.session(id);
    if (session) return res.json({ csrf: session.csrf });
    const now = Date.now();
    const hour = Math.floor(now / 3600000);
    if (
      !options.quota.take([
        {
          key: `session:${options.quota.hash(req.ip ?? "unknown")}:${hour}`,
          max: 30,
          expires: (hour + 1) * 3600000,
        },
      ])
    )
      return res
        .status(429)
        .json({ error: "สร้างเซสชันบ่อยเกินไป โปรดลองอีกครั้งในชั่วโมงถัดไป" });
    const created = options.quota.createSession();
    res.cookie("rebuild_session", created.id, {
      httpOnly: true,
      sameSite: "strict",
      secure: options.production && options.origin.startsWith("https:"),
      maxAge: 86400000,
      path: "/",
    });
    return res.json({ csrf: created.csrf });
  });
  // Only reveal the current session's effective allowance, never global/IP
  // counts, other visitors' activity, keys or provider billing details.
  app.get("/api/ai/limits", (req, res) => {
    const sessionId = cookie(req.headers.cookie);
    if (!options.quota.session(sessionId))
      return res.status(403).json({ error: "กรุณาเริ่มเซสชันก่อน" });
    const now = Date.now();
    const day = Math.floor(now / 86400000);
    const guest = options.quota.hash(sessionId!);
    const ip = options.quota.hash(req.ip ?? "unknown");
    const shared = Math.max(
      0,
      Math.min(
        (options.globalLimit ?? 50) - options.quota.used(`global:${day}`, now),
        (options.guestLimit ?? 10) -
          options.quota.used(`guest:${guest}:${day}`, now),
        (options.ipLimit ?? 15) - options.quota.used(`ip:${ip}:${day}`, now),
      ),
    );
    return res.json({
      aiEnabled: aiEnabled && !!options.provider,
      webSearchEnabled: aiEnabled && !!options.webSearchProvider,
      requestsRemaining: aiEnabled && options.provider ? shared : 0,
      webSearchRemaining:
        aiEnabled && options.webSearchProvider
          ? Math.max(
              0,
              Math.min(
                shared,
                (options.searchDailyLimit ?? 50) -
                  options.quota.used(`web-search:${day}`, now),
              ),
            )
          : 0,
      resetsAt: new Date((day + 1) * 86400000).toISOString(),
      currencyBudget: false,
    });
  });
  let active = 0;
  app.post(
    ["/api/ai", "/api/projects/search"],
    (req, res, next) => {
      const session = options.quota.session(cookie(req.headers.cookie));
      if (
        req.headers.origin !== options.origin ||
        !session ||
        req.headers["x-csrf-token"] !== session.csrf
      )
        return res
          .status(403)
          .json({ error: "เซสชันไม่ถูกต้อง กรุณารีเฟรชแล้วลองใหม่" });
      next();
    },
    express.json({ limit: "15mb" }),
    async (req, res) => {
      const isSearch = req.path === "/api/projects/search";
      const parsed = isSearch
        ? webSearchRequestSchema.safeParse(req.body)
        : requestSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          error: isSearch
            ? "เลือกวัสดุไม่เกิน 30 รายการ หรือระบุวัสดุและสิ่งที่อยากทำ ตรวจข้อความแล้วลองใหม่"
            : "ข้อมูลไม่ถูกต้องหรือยาวเกินกำหนด (บริบทข้อความไม่เกิน 50,000 ตัวอักษร) ตรวจข้อความและรูปภาพแล้วลองใหม่",
        });
      if (!aiEnabled)
        return res.status(503).json({
          error: "พักบริการ AI ชั่วคราว คลังวัสดุและแผนที่บันทึกยังใช้งานได้",
        });
      if (isSearch ? !options.webSearchProvider : !options.provider)
        return res.status(503).json({
          error: isSearch
            ? "ยังไม่ได้เชื่อมต่อบริการค้นเว็บ โปรเจกต์ใน ReBuild และคลังยังใช้งานได้"
            : "ยังไม่ได้เชื่อมต่อ AI คุณเพิ่มและยืนยันของด้วยตนเองได้ ข้อมูลเดิมยังอยู่",
        });
      const now = Date.now(),
        day = Math.floor(now / 86400000),
        minute = Math.floor(now / 60000),
        ip = options.quota.hash(req.ip ?? "unknown"),
        guest = options.quota.hash(cookie(req.headers.cookie) ?? "");
      const cacheKey = isSearch
        ? options.quota.hash(`${guest}:${JSON.stringify(parsed.data)}`)
        : "";
      const cached = isSearch ? searchCache.get(cacheKey, now) : undefined;
      if (cached) {
        if (
          !options.quota.take([
            {
              key: `cached-search:${guest}:${minute}`,
              max: 30,
              expires: (minute + 1) * 60000,
            },
          ])
        )
          return res
            .set("Retry-After", "60")
            .status(429)
            .json({ error: "เรียกผลค้นหาบ่อยเกินไป รอสักครู่แล้วลองใหม่" });
        trackUsage("web_search", "cache", Date.now() - now);
        return res
          .set("X-Rebuild-Cache", "hit")
          .set(
            "X-Rebuild-Cache-Expires",
            new Date(cached.expires).toISOString(),
          )
          .json(cached.value);
      }
      if (cacheKey && pendingSearches.has(cacheKey))
        return res
          .set("Retry-After", "5")
          .status(409)
          .json({ error: "คำค้นนี้กำลังทำงานอยู่ รอผลจากหน้าที่เริ่มค้นหา" });
      if (active >= 2)
        return res
          .set("Retry-After", "5")
          .status(429)
          .json({ error: "AI กำลังทำงานเต็มจำนวน โปรดลองอีกครั้ง" });
      if (
        !options.quota.take([
          ...(isSearch
            ? [
                {
                  key: `web-search:${day}`,
                  max: options.searchDailyLimit ?? 50,
                  expires: (day + 1) * 86400000,
                },
              ]
            : []),
          {
            key: `global:${day}`,
            max: options.globalLimit ?? 50,
            expires: (day + 1) * 86400000,
          },
          {
            key: `guest:${guest}:${day}`,
            max: options.guestLimit ?? 10,
            expires: (day + 1) * 86400000,
          },
          {
            key: `ip:${ip}:${day}`,
            max: options.ipLimit ?? 15,
            expires: (day + 1) * 86400000,
          },
          {
            key: `burst:${ip}:${minute}`,
            max: 3,
            expires: (minute + 1) * 60000,
          },
        ])
      ) {
        res.set("Retry-After", "60");
        return res.status(429).json({
          error:
            "ถึงขีดจำกัดการใช้ AI แล้ว หากครบโควตารายวันให้กลับมาหลัง 07:00 น. เวลาไทย คุณยังใช้คลังและโปรเจกต์ได้",
        });
      }
      active++;
      if (cacheKey) pendingSearches.add(cacheKey);
      const abort = new AbortController();
      const timer = setTimeout(
        () => abort.abort(),
        isSearch
          ? (options.searchTimeoutMs ?? 120000)
          : (options.timeoutMs ?? 30000),
      );
      res.on("close", () => {
        if (!res.writableEnded) abort.abort();
      });
      const start = Date.now();
      const mode = isSearch
        ? "web_search"
        : requestSchema.parse(parsed.data).mode;
      let phase = isSearch ? "search" : "image";
      try {
        if (isSearch) {
          const input = webSearchRequestSchema.parse(parsed.data);
          const result = await options.webSearchProvider!(input, abort.signal);
          if (abort.signal.aborted) throw Error("Search cancelled");
          const validated = webSearchResultSchema.parse(result);
          searchCache.put(cacheKey, validated);
          res.set("X-Rebuild-Cache", "miss");
          const saved = searchCache.get(cacheKey);
          if (saved)
            res.set(
              "X-Rebuild-Cache-Expires",
              new Date(saved.expires).toISOString(),
            );
          res.json(validated);
        } else {
          const input = await normalizeImages(requestSchema.parse(parsed.data));
          phase = "provider";
          const result = await options.provider!(input, abort.signal);
          if (abort.signal.aborted) throw Error("AI cancelled");
          res.json(sanitizeAIAnswer(result));
        }
        trackUsage(mode, "ok", Date.now() - start);
        console.info(
          JSON.stringify({
            event: "ai_request",
            outcome: "ok",
            ms: Date.now() - start,
            mode,
          }),
        );
      } catch {
        const code = abort.signal.aborted ? 504 : phase === "image" ? 400 : 502;
        trackUsage(mode, "error", Date.now() - start);
        if (!res.destroyed)
          res.status(code).json({
            error:
              code === 504
                ? "AI ใช้เวลานานเกินไป ลองใหม่ได้ ข้อมูลของคุณยังอยู่"
                : code === 400
                  ? "รูปภาพไม่รองรับหรือขนาดเกินกำหนด ใช้ JPEG, PNG หรือ WebP"
                  : isSearch
                    ? "ค้นเว็บไม่สำเร็จหรือแหล่งอ้างอิงไม่สมบูรณ์ ลองใหม่ได้ ระบบยังไม่ได้ยืนยันผลค้นหา"
                    : "AI ไม่พร้อมใช้งานหรือส่งข้อมูลไม่สมบูรณ์ โปรดลองใหม่หรือเพิ่มของเอง",
          });
        console.info(
          JSON.stringify({
            event: "ai_request",
            outcome: "error",
            ms: Date.now() - start,
            code,
          }),
        );
      } finally {
        clearTimeout(timer);
        if (cacheKey) pendingSearches.delete(cacheKey);
        active--;
      }
    },
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "ไม่พบเส้นทางนี้" }),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const tooLarge = error?.type === "entity.too.large";
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge
        ? "ข้อมูลเกินขนาดที่รองรับ"
        : "อ่านข้อมูลไม่ได้ กรุณาตรวจรูปแบบแล้วลองใหม่",
    });
  };
  app.use(errors);
  return app;
}
