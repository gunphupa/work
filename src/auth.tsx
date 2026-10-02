import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createClient,
  type SupabaseClient,
  type Session,
} from "@supabase/supabase-js";

type AccountContext = {
  client: SupabaseClient | null;
  session: Session | null;
  state: "loading" | "enabled" | "disabled" | "error";
  authError: boolean;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
};
const Context = createContext<AccountContext | null>(null);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AccountContext["state"]>("loading");
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    const abort = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/community/config", {
          signal: abort.signal,
        });
        if (!response.ok) throw Error();
        const config = await response.json();
        if (!alive) return;
        if (!config.enabled) {
          setState("disabled");
          return;
        }
        const next = createClient(config.url, config.publishableKey, {
          auth: {
            flowType: "pkce",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        const { data: listener } = next.auth.onAuthStateChange(
          (_event, value) => {
            if (alive) setSession(value);
          },
        );
        unsubscribe = () => {
          listener.subscription.unsubscribe();
          next.auth.stopAutoRefresh();
        };
        const { data, error } = await next.auth.getSession();
        if (!alive) {
          unsubscribe();
          return;
        }
        setSession(data.session);
        setClient(next);
        setState("enabled");
        const url = new URL(location.href);
        if (url.searchParams.get("auth") === "callback") {
          setAuthError(!!error || !data.session);
          url.search = "";
          url.hash = "/account";
          history.replaceState(null, "", url);
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
      abort.abort();
      unsubscribe?.();
    };
  }, []);
  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers);
      const { data } = client
        ? await client.auth.getSession()
        : { data: { session: null } };
      if (data.session)
        headers.set("Authorization", `Bearer ${data.session.access_token}`);
      if (options.body) headers.set("Content-Type", "application/json");
      const response = await fetch("/api/community" + path, {
        ...options,
        headers,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "service" }));
        throw Error(body.error ?? "service");
      }
      return response.status === 204 ? (undefined as T) : response.json();
    },
    [client],
  );
  return (
    <Context value={{ client, session, state, authError, request }}>
      {children}
    </Context>
  );
}
export function useAccount() {
  const value = useContext(Context);
  if (!value) throw Error("Missing account provider");
  return value;
}
export function communityError(
  code: string,
  t: (th: string, en: string) => string,
) {
  const messages: Record<string, [string, string]> = {
    signin: ["กรุณาเข้าสู่ระบบอีกครั้ง", "Please sign in again."],
    unavailable: [
      "ยังไม่เปิดใช้ระบบบัญชีและชุมชน",
      "Accounts and community posting are not connected yet.",
    ],
    forbidden: [
      "หน้านี้สำหรับผู้ดูแลเท่านั้น",
      "This action is for moderators only.",
    ],
    limit: [
      "ถึงขีดจำกัดแล้ว โปรดลองใหม่ภายหลัง",
      "The request limit was reached. Please try again later.",
    ],
    duplicate: [
      "คุณส่งรีวิวนี้แล้ว ดูสถานะในบัญชีของคุณ หรือลบรีวิวเดิมก่อนส่งใหม่",
      "You already submitted a review here. Check My submissions, or delete your previous review before replacing it.",
    ],
    photo: [
      "ใช้รูป JPEG, PNG หรือ WebP ไม่เกิน 2 MB และ 20 ล้านพิกเซล",
      "Use a JPEG, PNG or WebP image under 2 MB and 20 megapixels.",
    ],
    invalid: [
      "ตรวจชื่อ ข้อความ คะแนน และการยอมรับแนวทางชุมชน",
      "Check the name, text, rating and community-guideline agreement.",
    ],
    missing: [
      "ไม่พบโพสต์ หรือคุณไม่มีสิทธิ์เข้าถึง",
      "This post is unavailable or you do not have access.",
    ],
  };
  return t(
    ...(messages[code] ?? [
      "เชื่อมต่อไม่สำเร็จ ข้อความที่กรอกยังอยู่ โปรดลองอีกครั้ง",
      "The service could not complete the request. Your text is still here; please try again.",
    ]),
  );
}
