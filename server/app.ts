import express from "express";
import type { ErrorRequestHandler } from "express";
import { Quotas } from "./quota";
import { communityRouter } from "./community";
import type { CommunityStore } from "./community-store";
import {
  requestSchema,
  answerSchema,
  normalizeImages,
  type Provider,
} from "./ai";
export function createApp(options: {
  quota: Quotas;
  provider?: Provider;
  origin: string;
  production?: boolean;
  globalLimit?: number;
  guestLimit?: number;
  ipLimit?: number;
  timeoutMs?: number;
  community?: CommunityStore;
}) {
  const app = express();
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
      aiConfigured: !!options.provider,
      catalogueVersion: 1,
      communityConfigured: !!options.community,
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
  let active = 0;
  app.post(
    "/api/ai",
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
      const parsed = requestSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          error:
            "ข้อมูลไม่ถูกต้องหรือยาวเกินกำหนด (บริบทข้อความไม่เกิน 50,000 ตัวอักษร) ตรวจข้อความและรูปภาพแล้วลองใหม่",
        });
      if (!options.provider)
        return res.status(503).json({
          error:
            "ยังไม่ได้เชื่อมต่อ AI คุณเพิ่มและยืนยันของด้วยตนเองได้ ข้อมูลเดิมยังอยู่",
        });
      if (active >= 2)
        return res
          .status(429)
          .json({ error: "AI กำลังทำงานเต็มจำนวน โปรดลองอีกครั้ง" });
      const now = Date.now(),
        day = Math.floor(now / 86400000),
        minute = Math.floor(now / 60000),
        ip = options.quota.hash(req.ip ?? "unknown"),
        guest = options.quota.hash(cookie(req.headers.cookie) ?? "");
      if (
        !options.quota.take([
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
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), options.timeoutMs ?? 30000);
      res.on("close", () => {
        if (!res.writableEnded) abort.abort();
      });
      const start = Date.now();
      let phase = "image";
      try {
        const input = await normalizeImages(parsed.data);
        phase = "provider";
        const result = await options.provider(input, abort.signal);
        const answer = answerSchema.parse(result);
        res.json(answer);
        console.info(
          JSON.stringify({
            event: "ai_request",
            outcome: "ok",
            ms: Date.now() - start,
            mode: input.mode,
          }),
        );
      } catch {
        const code = abort.signal.aborted ? 504 : phase === "image" ? 400 : 502;
        if (!res.destroyed)
          res.status(code).json({
            error:
              code === 504
                ? "AI ใช้เวลานานเกินไป ลองใหม่ได้ ข้อมูลของคุณยังอยู่"
                : code === 400
                  ? "รูปภาพไม่รองรับหรือขนาดเกินกำหนด ใช้ JPEG, PNG หรือ WebP"
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
