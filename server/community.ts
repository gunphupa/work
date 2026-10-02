import {
  Router,
  json,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  submissionSchema,
  type Entry,
  type PublicEntry,
} from "../src/domain/community";
import { projectById } from "../src/data/projects";
import type { CommunityStore } from "./community-store";
import type { Quotas } from "./quota";

class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const uuid = z.uuid();
const pageOffset = z.coerce.number().int().min(0).max(100000).default(0);
const publicEntry = (entry: Entry, privateView = false): PublicEntry => {
  const { user_id: _owner, photo_path, ...copy } = entry;
  return {
    ...copy,
    hasPhoto: !!photo_path,
    moderation_note: privateView ? copy.moderation_note : "",
  };
};
export function communityRouter(
  store: CommunityStore | undefined,
  quota: Quotas,
  origin: string,
) {
  const router = Router();
  router.get("/config", (_req, res) =>
    res.json(store ? { enabled: true, ...store.config } : { enabled: false }),
  );
  router.use((req, res, next) => {
    if (!store) return res.status(503).json({ error: "unavailable" });
    if (!["GET", "HEAD"].includes(req.method) && req.headers.origin !== origin)
      return res.status(403).json({ error: "origin" });
    const minute = Math.floor(Date.now() / 60000);
    if (
      !quota.take([
        {
          key: `community-read:${quota.hash(req.ip ?? "unknown")}:${minute}`,
          max: 120,
          expires: (minute + 1) * 60000,
        },
      ])
    )
      return res.status(429).json({ error: "limit" });
    next();
  });
  async function user(req: Request) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ") || header.length > 8192)
      throw new RequestError(401, "signin");
    const id = await store!.user(header.slice(7));
    if (!id) throw new RequestError(401, "signin");
    return id;
  }
  async function admin(req: Request) {
    const id = await user(req);
    if (!(await store!.moderator(id))) throw new RequestError(403, "forbidden");
    return id;
  }
  router.get("/me", async (req, res) => {
    const id = await user(req);
    res.json({ moderator: await store!.moderator(id) });
  });
  router.get("/entries", async (req, res) => {
    const target = String(req.query.target ?? "");
    const kind = z.enum(["comment", "review"]).parse(req.query.kind);
    if (target !== "website" && !projectById[target])
      throw new RequestError(400, "invalid");
    const entries = await store!.list({
      target,
      kind,
      status: "approved",
      offset: pageOffset.parse(req.query.offset),
    });
    res.json({
      entries: entries.map((e) => publicEntry(e)),
      hasMore: entries.length === 20,
    });
  });
  router.get("/mine", async (req, res) => {
    const entries = await store!.list({
      owner: await user(req),
      offset: pageOffset.parse(req.query.offset),
    });
    res.json({
      entries: entries.map((e) => publicEntry(e, true)),
      hasMore: entries.length === 20,
    });
  });
  router.get("/queue", async (req, res) => {
    await admin(req);
    const status = z
      .enum(["pending", "approved", "rejected"])
      .parse(req.query.status ?? "pending");
    const entries = await store!.list({
      status,
      offset: pageOffset.parse(req.query.offset),
    });
    res.json({
      entries: entries.map((e) => publicEntry(e, true)),
      hasMore: entries.length === 20,
    });
  });
  router.post(
    "/entries",
    async (req, res, next) => {
      try {
        res.locals.userId = await user(req);
        const day = Math.floor(Date.now() / 86400000);
        if (
          !quota.take([
            {
              key: `community-submit:${res.locals.userId}:${day}`,
              max: 10,
              expires: (day + 1) * 86400000,
            },
            {
              key: `community-submit-global:${day}`,
              max: 100,
              expires: (day + 1) * 86400000,
            },
          ])
        )
          throw new RequestError(429, "limit");
        next();
      } catch (e) {
        next(e);
      }
    },
    json({ limit: "3mb" }),
    async (req, res) => {
      const data = submissionSchema.parse(req.body);
      if (data.target !== "website" && !projectById[data.target])
        throw new RequestError(400, "invalid");
      const id = randomUUID();
      let photoPath: string | null = null;
      if (data.photo) {
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.photo))
          throw new RequestError(400, "photo");
        try {
          const bytes = Buffer.from(data.photo, "base64");
          if (bytes.length > 2 * 1024 * 1024) throw Error();
          const photo = sharp(bytes, {
            limitInputPixels: 20000000,
            animated: false,
          });
          const metadata = await photo.metadata();
          if (
            !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
            (metadata.pages ?? 1) > 1
          )
            throw Error();
          const safe = await photo
            .rotate()
            .resize({
              width: 1200,
              height: 1200,
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 82 })
            .toBuffer();
          photoPath = `${res.locals.userId}/${id}.jpg`;
          await store!.upload(photoPath, safe);
        } catch {
          throw new RequestError(400, "photo");
        }
      }
      try {
        await store!.insert({
          id,
          user_id: res.locals.userId,
          target: data.target,
          kind: data.kind,
          name: data.name,
          body: data.body,
          rating: data.rating,
          difficulty: data.difficulty,
          outcome: data.outcome,
          photo_path: photoPath,
          status: "pending",
        });
      } catch (error) {
        if (photoPath) await store!.removePhoto(photoPath).catch(() => {});
        if ((error as { code?: string }).code === "23505")
          throw new RequestError(409, "duplicate");
        throw error;
      }
      res.status(201).json({ id, status: "pending" });
    },
  );
  router.patch(
    "/entries/:id",
    async (req, res, next) => {
      try {
        res.locals.adminId = await admin(req);
        next();
      } catch (e) {
        next(e);
      }
    },
    json({ limit: "8kb" }),
    async (req, res) => {
      const id = uuid.parse(req.params.id);
      const { status, note } = z
        .object({
          status: z.enum(["approved", "rejected"]),
          note: z.string().trim().max(500).default(""),
        })
        .strict()
        .parse(req.body);
      if (!(await store!.get(id))) throw new RequestError(404, "missing");
      await store!.moderate(id, res.locals.adminId, status, note);
      res.json({ status });
    },
  );
  router.delete("/entries/:id", async (req, res) => {
    const owner = await user(req);
    const entry = await store!.get(uuid.parse(req.params.id));
    if (!entry || (entry.user_id !== owner && !(await store!.moderator(owner))))
      throw new RequestError(404, "missing");
    // Removing the database record first revokes visibility even if storage is unavailable.
    await store!.remove(entry.id);
    if (entry.photo_path)
      await store!
        .removePhoto(entry.photo_path)
        .catch(() => console.warn("community_photo_cleanup_needed"));
    res.status(204).end();
  });
  router.get("/photos/:id", async (req, res) => {
    const entry = await store!.get(uuid.parse(req.params.id));
    if (!entry?.photo_path) throw new RequestError(404, "missing");
    if (entry.status !== "approved") {
      const owner = await user(req);
      if (entry.user_id !== owner && !(await store!.moderator(owner)))
        throw new RequestError(404, "missing");
    }
    const bytes = await store!.photo(entry.photo_path);
    res.type("image/jpeg").send(bytes);
  });
  router.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof RequestError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: "invalid" });
      if ((error as { type?: string })?.type === "entity.too.large")
        return res.status(413).json({ error: "photo" });
      return res.status(502).json({ error: "service" });
    },
  );
  return router;
}
