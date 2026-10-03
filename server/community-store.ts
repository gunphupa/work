import { createClient } from "@supabase/supabase-js";
import type { Entry } from "../src/domain/community";

export type CommunityConfig = {
  url: string;
  publishableKey: string;
  serviceKey: string;
};
export function communityConfig(): CommunityConfig | undefined {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !publishableKey && !serviceKey) return undefined;
  if (!url || !publishableKey || !serviceKey) return undefined;
  let publicKeyIsSafe = publishableKey.startsWith("sb_publishable_");
  if (!publicKeyIsSafe) {
    try {
      publicKeyIsSafe =
        JSON.parse(
          Buffer.from(publishableKey.split(".")[1], "base64url").toString(),
        ).role === "anon";
    } catch {
      /* A service key must never be returned as public configuration. */
    }
  }
  if (!publicKeyIsSafe || publishableKey === serviceKey)
    throw Error(
      "SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon key, never a service key.",
    );
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw Error("SUPABASE_URL must be the HTTPS project URL from Supabase.");
  return { url: parsed.origin, publishableKey, serviceKey };
}
export interface CommunityStore {
  config: { url: string; publishableKey: string };
  user(token: string): Promise<string | null>;
  moderator(userId: string): Promise<boolean>;
  takeSubmission(userId: string): Promise<boolean>;
  list(filter: {
    target?: string;
    kind?: string;
    owner?: string;
    status?: string;
    offset: number;
  }): Promise<Entry[]>;
  get(id: string): Promise<Entry | null>;
  insert(entry: Omit<Entry, "created_at" | "moderation_note">): Promise<void>;
  moderate(
    id: string,
    actor: string,
    status: "approved" | "rejected",
    note: string,
  ): Promise<void>;
  remove(id: string): Promise<void>;
  upload(path: string, bytes: Buffer): Promise<void>;
  photo(path: string): Promise<Buffer>;
  removePhoto(path: string): Promise<void>;
}
export function supabaseStore(config: CommunityConfig): CommunityStore {
  const db = createClient(config.url, config.serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  const bucket = db.storage.from("community-photos");
  const check = (error: unknown) => {
    if (error) throw error;
  };
  return {
    config: { url: config.url, publishableKey: config.publishableKey },
    async user(token) {
      const { data, error } = await db.auth.getUser(token);
      return !error && data.user?.email_confirmed_at ? data.user.id : null;
    },
    async takeSubmission(userId) {
      const { data, error } = await db.rpc("take_community_submission", {
        actor_id: userId,
      });
      check(error);
      if (typeof data !== "boolean")
        throw Error("Invalid submission quota response");
      return data;
    },
    async moderator(userId) {
      const { data, error } = await db
        .from("community_moderators")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      check(error);
      return !!data;
    },
    async list({ target, kind, owner, status, offset }) {
      let query = db.from("community_entries").select("*");
      if (target) query = query.eq("target", target);
      if (kind) query = query.eq("kind", kind);
      if (owner) query = query.eq("user_id", owner);
      if (status) query = query.eq("status", status);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 19);
      check(error);
      return data as Entry[];
    },
    async get(id) {
      const { data, error } = await db
        .from("community_entries")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      check(error);
      return data as Entry | null;
    },
    async insert(entry) {
      const { error } = await db.from("community_entries").insert(entry);
      check(error);
    },
    async moderate(id, actor, status, note) {
      const { error } = await db.rpc("moderate_community_entry", {
        entry_id: id,
        actor_id: actor,
        decision: status,
        note,
      });
      check(error);
    },
    async remove(id) {
      const { error } = await db
        .from("community_entries")
        .delete()
        .eq("id", id);
      check(error);
    },
    async upload(path, bytes) {
      const { error } = await bucket.upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });
      check(error);
    },
    async photo(path) {
      const { data, error } = await bucket.download(path);
      check(error);
      return Buffer.from(await data!.arrayBuffer());
    },
    async removePhoto(path) {
      const { error } = await bucket.remove([path]);
      check(error);
    },
  };
}
