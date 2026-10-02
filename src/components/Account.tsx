import { useState } from "react";
import { UserRound } from "lucide-react";
import { useAccount } from "../auth";
import { useLanguage } from "../i18n";
import { SubmissionList } from "./Community";
export function AccountLink() {
  const { session } = useAccount();
  const { t } = useLanguage();
  return (
    <a
      className="account-link"
      href="#/account"
      aria-label={
        session ? t("บัญชีของฉัน", "My account") : t("เข้าสู่ระบบ", "Sign in")
      }
    >
      <UserRound size={18} />
      <span>
        {session ? t("บัญชี", "Account") : t("เข้าสู่ระบบ", "Sign in")}
      </span>
    </a>
  );
}
export function AccountPage() {
  const { client, session, state, authError } = useAccount();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const callback = `${location.origin}/?auth=callback`;
  async function signIn(google: boolean) {
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const { error } = google
        ? await client.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: callback },
          })
        : await client.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: callback },
          });
      if (error) throw error;
      if (!google)
        setMessage(
          t(
            "เปิดอีเมลแล้วกดลิงก์เข้าสู่ระบบในเบราว์เซอร์นี้ ตรวจโฟลเดอร์สแปมด้วย",
            "Check your inbox and open the sign-in link in this browser. Also check spam.",
          ),
        );
    } catch {
      setFailed(true);
      setMessage(
        t(
          "เข้าสู่ระบบไม่สำเร็จ ตรวจอีเมลหรือลองใหม่ภายหลัง",
          "Sign-in could not start. Check the email address or try again later.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{t("บัญชีของคุณ", "Your account")}</h1>
      <p className="lead">
        {t(
          "อ่านคู่มือได้เสมอ เข้าสู่ระบบเมื่ออยากแบ่งปันและรีวิว",
          "Read guides freely. Sign in when you want to share and review.",
        )}
      </p>
      {authError && (
        <p className="notice error" role="alert">
          {t(
            "ลิงก์เข้าสู่ระบบใช้ไม่ได้หรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่",
            "The sign-in link could not be used or has expired. Request a new link.",
          )}
        </p>
      )}
      {state !== "enabled" ? (
        <div className="panel">
          <h2>
            {state === "loading"
              ? t("กำลังตรวจระบบบัญชี", "Checking account service")
              : t("ยังไม่เปิดใช้ระบบบัญชี", "Accounts are not connected yet")}
          </h2>
          <p>
            {state === "error"
              ? t(
                  "เชื่อมต่อบริการไม่ได้ ลองโหลดหน้าใหม่ คู่มือยังอ่านได้",
                  "The service could not be reached. Try reloading; guides remain open.",
                )
              : t(
                  "คุณยังอ่านคู่มือและบันทึกงานในเบราว์เซอร์ได้ เราจะเปิดรับโพสต์เมื่อเชื่อมระบบบัญชีแล้ว",
                  "You can still read guides and save builds in this browser. Posting will open once accounts are connected.",
                )}
          </p>
        </div>
      ) : session ? (
        <>
          <div className="panel account-panel">
            <h2>{t("เข้าสู่ระบบแล้ว", "You’re signed in")}</h2>
            <p>{session.user.email}</p>
            <p>
              {t(
                "โพสต์และรีวิวจะเผยแพร่หลังผู้ดูแลอนุมัติ คลังวัสดุและบันทึกงานยังเก็บในเบราว์เซอร์นี้",
                "Posts and reviews become public after approval. Your inventory and saved builds still live in this browser.",
              )}
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await client!.auth.signOut();
                if (error) {
                  setFailed(true);
                  setMessage(
                    t(
                      "ออกจากระบบไม่สำเร็จ ลองอีกครั้ง",
                      "Sign-out failed. Please try again.",
                    ),
                  );
                }
                setBusy(false);
              }}
            >
              {t("ออกจากระบบ", "Sign out")}
            </button>
          </div>
          <SubmissionList mode="mine" />
        </>
      ) : (
        <div className="panel account-panel">
          <h2>
            {t("เข้าสู่ระบบหรือสร้างบัญชี", "Sign in or create an account")}
          </h2>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => signIn(true)}
          >
            {t("ดำเนินการต่อด้วย Google", "Continue with Google")}
          </button>
          <p className="form-hint">
            {t(
              "หรือรับลิงก์ทางอีเมล ไม่ต้องตั้งรหัสผ่าน",
              "Or receive an email link. No password to remember.",
            )}
          </p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void signIn(false);
            }}
          >
            <label>
              {t("อีเมล", "Email")}
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy
                ? t("กำลังดำเนินการ…", "Working…")
                : t("ส่งลิงก์เข้าสู่ระบบ", "Email me a sign-in link")}
            </button>
          </form>
          <p className="form-hint">
            {t(
              "ลิงก์ครั้งแรกจะสร้างบัญชีให้คุณ Google และบริการบัญชีจะประมวลผลข้อมูลการเข้าสู่ระบบ อย่าใช้อีเมลหรือที่อยู่จริงเป็นชื่อสาธารณะ",
              "Your first link creates an account. Google and our account provider process sign-in data. Choose a public name that does not reveal your email or address.",
            )}
          </p>
        </div>
      )}
      {message && (
        <p
          className={failed ? "notice error" : "notice"}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </>
  );
}
