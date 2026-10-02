import { useEffect, useState, type FormEvent } from "react";
import { Camera, Star } from "lucide-react";
import { useLanguage } from "../i18n";
import { useAccount, communityError } from "../auth";
import { localizeProject, projectById } from "../data/projects";
import type { PublicEntry } from "../domain/community";

type FeedResult = { entries: PublicEntry[]; hasMore: boolean };
export function ProjectCommunity({ target }: { target: string }) {
  const { t } = useLanguage();
  return (
    <section
      className="project-community"
      aria-label={t("ชุมชนและรีวิว", "Community and reviews")}
    >
      <div className="community-heading">
        <h2>
          {target === "website"
            ? t("ช่วยพัฒนา ReBuild", "Help improve ReBuild")
            : t("เรียนรู้ไปด้วยกัน", "Learn from each other")}
        </h2>
        <p>
          {t(
            "แบ่งปันสิ่งที่ได้ลอง ทุกโพสต์และรีวิวจะเผยแพร่หลังผู้ดูแลอนุมัติ",
            "Share what you tried. Every post and review is checked by a moderator before publication.",
          )}
        </p>
      </div>
      <div className={target === "website" ? "" : "community-grid"}>
        {target !== "website" && (
          <CommunityFeed target={target} kind="comment" />
        )}
        <CommunityFeed target={target} kind="review" />
      </div>
      <Guidelines />
    </section>
  );
}
function CommunityFeed({
  target,
  kind,
}: {
  target: string;
  kind: "comment" | "review";
}) {
  const { t } = useLanguage();
  const { state, session, request } = useAccount();
  const [items, setItems] = useState<PublicEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (state !== "enabled") return;
    let alive = true;
    setLoading(true);
    setError("");
    request<FeedResult>(
      `/entries?target=${encodeURIComponent(target)}&kind=${kind}&offset=${offset}`,
    )
      .then((r) => {
        if (alive) {
          setItems(r.entries);
          setMore(r.hasMore);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [state, target, kind, offset, request, retry]);
  return (
    <section className="panel community-feed">
      {kind === "comment" ? (
        <Camera size={26} aria-hidden="true" />
      ) : (
        <Star size={26} aria-hidden="true" />
      )}
      <h3>
        {kind === "comment"
          ? t("แบ่งปันผลงานและพูดคุย", "Share your build & discuss")
          : target === "website"
            ? t("รีวิวเว็บไซต์", "Website reviews")
            : t("รีวิวโปรเจกต์", "Project reviews")}
      </h3>
      <p>
        {kind === "comment"
          ? t(
              "รูปผลงาน คำถาม เคล็ดลับ และวัสดุทดแทนที่คุณได้ลอง",
              "Finished-build photos, questions, useful tips and substitutions you tried.",
            )
          : t(
              "อะไรใช้ได้ดี? อะไรอยากให้ปรับ? รีวิวตามประสบการณ์จริง รวมถึงสิ่งที่ยังใช้ไม่ได้",
              "What worked well? What needs improving? Share your experience, including what did not work.",
            )}
      </p>
      {state === "disabled" || state === "error" ? (
        <p className="community-status">
          {t(
            "ยังไม่เปิดรับโพสต์และรีวิว ระบบบัญชียังไม่ได้เชื่อมต่อ",
            "Posting and reviews are not open yet. Accounts are not connected.",
          )}
        </p>
      ) : state === "loading" ? (
        <p role="status">{t("กำลังตรวจบริการ…", "Checking service…")}</p>
      ) : (
        <>
          {session ? (
            <button
              className="secondary"
              onClick={() => {
                setOpen(!open);
                setSent(false);
              }}
            >
              {open
                ? t("ปิดแบบฟอร์ม", "Close form")
                : kind === "comment"
                  ? t("แบ่งปันหรือถามคำถาม", "Share or ask a question")
                  : t("เขียนรีวิว", "Write a review")}
            </button>
          ) : (
            <a className="secondary" href="#/account">
              {t("เข้าสู่ระบบเพื่อร่วมแบ่งปัน", "Sign in to contribute")}
            </a>
          )}
          {open && session && (
            <SubmissionForm
              target={target}
              kind={kind}
              done={() => {
                setOpen(false);
                setSent(true);
              }}
            />
          )}
          {sent && (
            <p role="status" className="notice">
              {t(
                "ส่งแล้ว กำลังรออนุมัติ ดูสถานะได้ในบัญชีของคุณ",
                "Submitted. Waiting for approval. Track its status in your account.",
              )}{" "}
              <a href="#/account">{t("บัญชีของฉัน", "My account")}</a>
            </p>
          )}
          {loading ? (
            <p role="status">{t("กำลังโหลด…", "Loading…")}</p>
          ) : error ? (
            <p role="alert">
              {communityError(error, t)}{" "}
              <button className="text-link" onClick={() => setRetry(retry + 1)}>
                {t("ลองใหม่", "Retry")}
              </button>
            </p>
          ) : (
            <>
              {!items.length && (
                <p className="community-empty">
                  {kind === "review"
                    ? t("ยังไม่มีรีวิวที่เผยแพร่", "No published reviews yet.")
                    : t(
                        "ยังไม่มีผลงานหรือความคิดเห็นที่เผยแพร่",
                        "No published builds or comments yet.",
                      )}
                </p>
              )}
              {items.map((e) => (
                <EntryCard entry={e} key={e.id} />
              ))}
              <Pagination offset={offset} more={more} change={setOffset} />
            </>
          )}
        </>
      )}
    </section>
  );
}
function SubmissionForm({
  target,
  kind,
  done,
}: {
  target: string;
  kind: "comment" | "review";
  done: () => void;
}) {
  const { t } = useLanguage();
  const { request } = useAccount();
  const [name, setName] = useState(""),
    [body, setBody] = useState(""),
    [rating, setRating] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [outcome, setOutcome] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let photo: string | undefined;
      if (file) {
        if (
          file.size > 2 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        )
          throw Error("photo");
        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(Error("photo"));
          reader.readAsDataURL(file);
        });
        photo = result.split(",")[1];
      }
      await request("/entries", {
        method: "POST",
        body: JSON.stringify({
          target,
          kind,
          name,
          body,
          rating: kind === "review" ? Number(rating) : null,
          difficulty: difficulty || null,
          outcome: outcome || null,
          photo,
          guidelines: agreed,
        }),
      });
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack community-form" onSubmit={submit}>
      <label>
        {t("ชื่อที่แสดงสาธารณะ", "Public display name")}
        <input
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
        />
      </label>
      {kind === "review" && (
        <label>
          {t("คะแนน", "Rating")}
          <select
            required
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="">{t("เลือกคะแนน", "Choose a rating")}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === "review" && target !== "website" && (
        <div className="form-columns">
          <label>
            {t("ความยากที่พบ (ไม่บังคับ)", "Difficulty (optional)")}
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">{t("ไม่ระบุ", "Not specified")}</option>
              <option value="easy">{t("ง่าย", "Easy")}</option>
              <option value="moderate">{t("ปานกลาง", "Moderate")}</option>
              <option value="hard">{t("ยาก", "Hard")}</option>
            </select>
          </label>
          <label>
            {t("ผลที่ได้ (ไม่บังคับ)", "Result (optional)")}
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">{t("ไม่ระบุ", "Not specified")}</option>
              <option value="worked">{t("ใช้ได้ตามต้องการ", "Worked")}</option>
              <option value="partly">
                {t("ใช้ได้บางส่วน", "Partly worked")}
              </option>
              <option value="not-yet">
                {t("ยังใช้ไม่ได้", "Not working yet")}
              </option>
            </select>
          </label>
        </div>
      )}
      <label>
        {kind === "review"
          ? t("ประสบการณ์ของคุณ", "Your experience")
          : t("ข้อความหรือคำถาม", "Message or question")}
        <textarea
          required
          minLength={10}
          maxLength={3000}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      {target !== "website" && (
        <label>
          {t("รูปผลงาน 1 รูป (ไม่บังคับ)", "One build photo (optional)")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="form-hint">
            {t(
              "JPEG, PNG, WebP ไม่เกิน 2 MB และ 20 ล้านพิกเซล หลีกเลี่ยงข้อมูลส่วนตัวในภาพ",
              "JPEG, PNG or WebP, up to 2 MB and 20 megapixels. Keep personal details out of the image.",
            )}
          </span>
        </label>
      )}
      <label className="agreement">
        <input
          required
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>
          {t(
            "ฉันอ่านแนวทางชุมชนด้านล่าง และมีสิทธิ์แบ่งปันข้อความและรูปนี้",
            "I have read the community guidelines below and have permission to share this text and photo.",
          )}
        </span>
      </label>
      <p className="form-hint">
        {t(
          "ผู้ดูแลจะตรวจโพสต์ก่อนเผยแพร่ ชื่อที่แสดง ข้อความ คะแนน และรูปที่อนุมัติจะเป็นสาธารณะ",
          "A moderator will review this first. Your display name, text, rating and approved photo will be public.",
        )}
      </p>
      <button className="primary" disabled={busy}>
        {busy
          ? t("กำลังส่ง…", "Submitting…")
          : t("ส่งให้ผู้ดูแลตรวจ", "Submit for approval")}
      </button>
      {error && <p role="alert">{communityError(error, t)}</p>}
    </form>
  );
}
function EntryPhoto({ entry }: { entry: PublicEntry }) {
  const { client, session } = useAccount();
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let blobUrl = "";
    let alive = true;
    setUrl("");
    setError(false);
    (async () => {
      try {
        const { data } = client
          ? await client.auth.getSession()
          : { data: { session: null } };
        const response = await fetch(`/api/community/photos/${entry.id}`, {
          signal: controller.signal,
          headers: data.session
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {},
        });
        if (!response.ok) throw Error();
        const blob = await response.blob();
        if (!alive) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [client, session?.user.id, entry.id, entry.status]);
  return url ? (
    <img
      className="community-photo"
      src={url}
      alt={t(
        `รูปผลงานที่ ${entry.name} แบ่งปัน`,
        `Build photo shared by ${entry.name}`,
      )}
    />
  ) : (
    <p>
      {error
        ? t("โหลดรูปไม่สำเร็จ", "Photo could not be loaded.")
        : t("กำลังโหลดรูป…", "Loading photo…")}
    </p>
  );
}
function EntryCard({
  entry,
  privateView = false,
}: {
  entry: PublicEntry;
  privateView?: boolean;
}) {
  const { t, language } = useLanguage();
  const difficulty = {
    easy: t("ง่าย", "Easy"),
    moderate: t("ปานกลาง", "Moderate"),
    hard: t("ยาก", "Hard"),
  };
  const outcome = {
    worked: t("ใช้ได้ตามต้องการ", "Worked"),
    partly: t("ใช้ได้บางส่วน", "Partly worked"),
    "not-yet": t("ยังใช้ไม่ได้", "Not working yet"),
  };
  return (
    <article className="community-entry">
      <div className="entry-byline">
        <strong>{entry.name}</strong>
        <time dateTime={entry.created_at}>
          {new Date(entry.created_at).toLocaleDateString(
            language === "th" ? "th-TH" : "en-GB",
          )}
        </time>
      </div>
      {entry.rating !== null && (
        <p className="review-rating">
          <Star size={16} />
          {entry.rating} / 5
          {entry.difficulty &&
            ` · ${difficulty[entry.difficulty as keyof typeof difficulty]}`}
          {entry.outcome &&
            ` · ${outcome[entry.outcome as keyof typeof outcome]}`}
        </p>
      )}
      <p className="entry-body">{entry.body}</p>
      {entry.hasPhoto && <EntryPhoto entry={entry} />}
      {privateView && (
        <p className="community-status">
          {entry.status === "pending"
            ? t("รออนุมัติ", "Waiting for approval")
            : entry.status === "approved"
              ? t("เผยแพร่แล้ว", "Published")
              : t("ไม่อนุมัติ", "Not approved")}
        </p>
      )}
      {privateView && entry.moderation_note && (
        <p>
          {t("ข้อความจากผู้ดูแล: ", "Moderator note: ")}
          {entry.moderation_note}
        </p>
      )}
    </article>
  );
}
function Pagination({
  offset,
  more,
  change,
}: {
  offset: number;
  more: boolean;
  change: (n: number) => void;
}) {
  const { t } = useLanguage();
  return offset > 0 || more ? (
    <div className="button-row">
      <button
        className="secondary"
        disabled={offset === 0}
        onClick={() => change(Math.max(0, offset - 20))}
      >
        {t("หน้าก่อนหน้า", "Previous page")}
      </button>
      <button
        className="secondary"
        disabled={!more}
        onClick={() => change(offset + 20)}
      >
        {t("หน้าถัดไป", "Next page")}
      </button>
    </div>
  ) : null;
}
export function SubmissionList({ mode }: { mode: "mine" | "queue" }) {
  const { session, state, request } = useAccount();
  const { t, language } = useLanguage();
  const [admin, setAdmin] = useState(false),
    [items, setItems] = useState<PublicEntry[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [filter, setFilter] = useState("pending"),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!session || state !== "enabled") {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const me = await request<{ moderator: boolean }>("/me");
        if (!alive) return;
        setAdmin(me.moderator);
        if (mode === "queue" && !me.moderator) throw Error("forbidden");
        const result = await request<FeedResult>(
          mode === "mine"
            ? `/mine?offset=${offset}`
            : `/queue?status=${filter}&offset=${offset}`,
        );
        if (alive) {
          setItems(result.entries);
          setMore(result.hasMore);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session?.user.id, state, request, mode, offset, filter, version]);
  async function action(id: string, status?: "approved" | "rejected") {
    if (busy) return;
    if (
      !status &&
      !confirm(
        t(
          "ลบโพสต์นี้และรูปที่แนบถาวร?",
          "Permanently delete this submission and its photo?",
        ),
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`/entries/${id}`, {
        method: status ? "PATCH" : "DELETE",
        ...(status
          ? { body: JSON.stringify({ status, note: notes[id] ?? "" }) }
          : {}),
      });
      setVersion(version + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <p>
        {t("เข้าสู่ระบบเพื่อดูรายการของคุณ", "Sign in to view submissions.")}{" "}
        <a href="#/account">{t("เข้าสู่ระบบ", "Sign in")}</a>
      </p>
    );
  return (
    <section className="submission-list">
      <h2>
        {mode === "mine"
          ? t("โพสต์และรีวิวของฉัน", "My submissions")
          : t("ตรวจโพสต์ก่อนเผยแพร่", "Review before publishing")}
      </h2>
      {mode === "mine" && admin && (
        <a className="secondary" href="#/moderation">
          {t("เปิดหน้าผู้ดูแล", "Open moderation queue")}
        </a>
      )}
      {mode === "queue" && (
        <>
          <p>
            {t(
              "ตรวจตามแนวทางชุมชน อนุญาตรีวิวเชิงลบที่สุภาพและจริงใจ อย่าปฏิเสธเพียงเพราะคะแนนต่ำ",
              "Apply the community guidelines consistently. Allow respectful, honest negative reviews; do not reject a review simply for a low rating.",
            )}
          </p>
          <label>
            {t("สถานะ", "Status")}
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setOffset(0);
              }}
            >
              <option value="pending">
                {t("รออนุมัติ", "Waiting for approval")}
              </option>
              <option value="approved">{t("เผยแพร่แล้ว", "Published")}</option>
              <option value="rejected">
                {t("ไม่อนุมัติ", "Not approved")}
              </option>
            </select>
          </label>
        </>
      )}
      {error && (
        <p role="alert">
          {communityError(error, t)}{" "}
          <button className="text-link" onClick={() => setVersion(version + 1)}>
            {t("ลองใหม่", "Retry")}
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">{t("กำลังโหลด…", "Loading…")}</p>
      ) : (
        !error && (
          <>
            {!items.length && (
              <p>{t("ไม่มีรายการในหน้านี้", "No submissions on this page.")}</p>
            )}
            {items.map((e) => (
              <div className="panel" key={e.id}>
                <a
                  href={
                    e.target === "website"
                      ? "#/reviews"
                      : `#/project/${e.target}`
                  }
                >
                  {e.target === "website"
                    ? t("รีวิวเว็บไซต์", "Website reviews")
                    : projectById[e.target]
                      ? localizeProject(projectById[e.target], language).title
                      : e.target}
                </a>
                <EntryCard entry={e} privateView />
                {mode === "queue" && admin && (
                  <>
                    <label>
                      {t(
                        "เหตุผลหรือคำแนะนำสำหรับผู้เขียน",
                        "Note for the author",
                      )}
                      <textarea
                        maxLength={500}
                        value={notes[e.id] ?? ""}
                        onChange={(ev) =>
                          setNotes({ ...notes, [e.id]: ev.target.value })
                        }
                      />
                    </label>
                    <div className="button-row">
                      <button
                        className="primary"
                        disabled={busy || e.status === "approved"}
                        onClick={() => action(e.id, "approved")}
                      >
                        {t("อนุมัติและเผยแพร่", "Approve & publish")}
                      </button>
                      <button
                        className="secondary"
                        disabled={busy || e.status === "rejected"}
                        onClick={() => action(e.id, "rejected")}
                      >
                        {e.status === "approved"
                          ? t("ถอนการเผยแพร่", "Unpublish")
                          : t("ไม่อนุมัติ", "Reject")}
                      </button>
                    </div>
                  </>
                )}
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => action(e.id)}
                >
                  {t("ลบโพสต์", "Delete submission")}
                </button>
              </div>
            ))}
            <Pagination offset={offset} more={more} change={setOffset} />
          </>
        )
      )}
      {mode === "queue" && <Guidelines />}
    </section>
  );
}
function Guidelines() {
  const { t } = useLanguage();
  return (
    <details className="panel community-guidelines">
      <summary>{t("แนวทางชุมชน", "Community guidelines")}</summary>
      <ul>
        <li>
          {t(
            "เคารพกัน ให้คำแนะนำที่ชัดเจนและเป็นประโยชน์ ไม่ล้อเลียนผู้เริ่มต้น",
            "Be kind and specific. Help beginners without insults or harassment.",
          )}
        </li>
        <li>
          {t(
            "บอกสิ่งที่ได้ลองจริง แยกผลที่สังเกตได้ออกจากคำแนะนำที่ยังไม่ได้ทดลอง",
            "Describe what you actually tried. Separate observed results from untested suggestions.",
          )}
        </li>
        <li>
          {t(
            "โพสต์เฉพาะรูปที่คุณมีสิทธิ์แบ่งปัน ให้เครดิตแหล่งที่มา และขออนุญาตบุคคลในภาพ",
            "Share photos you have permission to use, credit sources, and get consent from people pictured.",
          )}
        </li>
        <li>
          {t(
            "ไม่เผยแพร่ข้อมูลส่วนตัว เช่น ที่อยู่ เบอร์โทร หรือข้อมูลของเด็กในข้อความและรูป",
            "Keep personal information out of posts and photos, including addresses, phone numbers, and children’s identifying details.",
          )}
        </li>
        <li>
          {t(
            "ไม่ส่งสแปม โฆษณาแฝง หรือคำแนะนำที่ชวนให้ข้ามขั้นตอนความปลอดภัย",
            "No spam, undisclosed promotion, or advice to skip safety precautions.",
          )}
        </li>
        <li>
          {t(
            "รีวิวอย่างตรงไปตรงมาตามประสบการณ์ ไม่ให้คะแนนสิ่งที่ยังไม่ได้ลอง",
            "Review honestly from your own experience. Only rate projects you have tried.",
          )}
        </li>
      </ul>
    </details>
  );
}
