import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Download,
  Globe2,
  LoaderCircle,
  Search,
  BookmarkPlus,
  MessageSquare,
} from "lucide-react";
import { useLanguage, unitText } from "../i18n";
import type { InventoryItem } from "../domain/schema";
import {
  searchMaterialsPayload,
  webSearchResultSchema,
  type WebSearchResult,
  type WebSource,
  type WebProject,
  type WebSearchRequest,
} from "../domain/web-projects";

import { saveExternalPlan } from "../domain/external-plans";
import {
  captureResearchSessionId,
  recordResearchEvent,
} from "../domain/research";
import {
  readSearchDraft,
  writeSearchDraft,
  saveWebFeedback,
  downloadWebFeedback,
  downloadSearchRecovery,
  WEB_DRAFT_KEY,
  WEB_FEEDBACK_KEY,
  type SearchDraft,
  type WebFeedback,
} from "../domain/web-search-local";
import "./web-project-improvements.css";

type Limits = {
  aiEnabled: boolean;
  webSearchEnabled: boolean;
  requestsRemaining: number;
  webSearchRemaining: number;
  resetsAt: string;
};

export function WebProjects({ inventory }: { inventory: InventoryItem[] }) {
  const { t, language } = useLanguage();
  const [initial] = useState(() => {
    try {
      return { draft: readSearchDraft(), error: false };
    } catch {
      return { draft: null, error: true };
    }
  });
  const [draftError, setDraftError] = useState(initial.error);
  const [selected, setSelected] = useState(
    () =>
      initial.draft?.selected.filter((id) =>
        inventory.some((item) => item.id === id),
      ) ?? inventory.slice(0, 30).map((i) => i.id),
  );
  const [query, setQuery] = useState(initial.draft?.query ?? "");
  const [difficulty, setDifficulty] = useState<SearchDraft["difficulty"]>(
    initial.draft?.difficulty ?? "any",
  );
  const [maxMinutes, setMaxMinutes] = useState(initial.draft?.maxMinutes ?? "");
  const [maxBudgetThb, setMaxBudgetThb] = useState(
    initial.draft?.maxBudgetThb ?? "",
  );
  const [additionalSupplies, setAdditionalSupplies] = useState<
    SearchDraft["additionalSupplies"]
  >(initial.draft?.additionalSupplies ?? "allow");
  const [elapsed, setElapsed] = useState(0);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [feedbackRecovery, setFeedbackRecovery] = useState(false);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    signature: string;
    data: WebSearchResult;
    cached: boolean;
    cacheExpires: string | null;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const chosen = inventory.filter((i) => selected.includes(i.id));
  const preferences =
    difficulty !== "any" ||
    maxMinutes !== "" ||
    maxBudgetThb !== "" ||
    additionalSupplies !== "allow"
      ? {
          difficulty,
          additionalSupplies,
          ...(maxMinutes !== "" ? { maxMinutes: Number(maxMinutes) } : {}),
          ...(maxBudgetThb !== ""
            ? { maxBudgetThb: Number(maxBudgetThb) }
            : {}),
        }
      : undefined;
  const request: WebSearchRequest = {
    language,
    query: query.trim(),
    materials: searchMaterialsPayload(chosen),
    ...(preferences ? { preferences } : {}),
  };
  const signature = JSON.stringify(request);
  const visible = result?.signature === signature ? result.data : null;
  const filtered = inventory.filter((i) =>
    i.label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
  );
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (draftError) return;
    try {
      writeSearchDraft({
        version: 1,
        selected,
        query,
        difficulty,
        maxMinutes,
        maxBudgetThb,
        additionalSupplies,
      });
    } catch {
      setDraftError(true);
    }
  }, [
    selected,
    query,
    difficulty,
    maxMinutes,
    maxBudgetThb,
    additionalSupplies,
    draftError,
  ]);
  useEffect(() => {
    if (!busy) return;
    const started = performance.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((performance.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy]);

  async function refreshLimits(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/ai/limits", { signal });
      if (!response.ok) return;
      const data = await response.json();
      if (
        Number.isInteger(data.webSearchRemaining) &&
        data.webSearchRemaining >= 0 &&
        typeof data.webSearchEnabled === "boolean" &&
        Number.isFinite(Date.parse(data.resetsAt))
      )
        setLimits(data);
    } catch {
      /* Limits are supplementary; do not hide a completed result. */
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setElapsed(0);
    const started = performance.now();
    const researchSessionId = captureResearchSessionId();
    recordResearchEvent("search_started", {}, researchSessionId);
    setError("");
    setResult(null);
    const timer = setTimeout(() => abort.abort("timeout"), 130000);
    try {
      const session = await fetch("/api/session", { signal: abort.signal });
      if (!session.ok)
        throw Error(
          t(
            "สร้างเซสชันไม่สำเร็จ ลองใหม่ภายหลัง",
            "Could not start a session. Try again later.",
          ),
        );
      const { csrf } = await session.json();
      void refreshLimits(abort.signal);
      const response = await fetch("/api/projects/search", {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: signature,
      });
      const data = await response.json();
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: "Select up to 30 materials or describe what you have. Shorten long details and try again.",
          403: "The session expired. Refresh this page and try again.",
          409: "This search is already running. Wait a moment before trying again.",
          429: "The AI usage limit has been reached or the service is busy. Try again later.",
          503: "Web search is not configured. Your inventory and catalogue guides are still available.",
          504: "The search timed out. Your materials are unchanged; try a more specific query.",
        };
        throw Error(
          language === "th"
            ? data.error || "ค้นเว็บไม่สำเร็จ"
            : messages[response.status] ||
                "Web search could not return supported results. Try again.",
        );
      }
      const parsed = webSearchResultSchema.parse(data);
      if (!abort.signal.aborted) {
        const cached = response.headers.get("X-Rebuild-Cache") === "hit";
        const expires = response.headers.get("X-Rebuild-Cache-Expires");
        setResult({
          signature,
          data: parsed,
          cached,
          cacheExpires:
            expires && Number.isFinite(Date.parse(expires)) ? expires : null,
        });
        recordResearchEvent(
          "search_completed",
          {
            elapsedMs: Math.round(performance.now() - started),
            resultCount: parsed.projects.length,
            cached,
            status: "success",
          },
          researchSessionId,
        );
      }
    } catch (e) {
      recordResearchEvent(
        abort.signal.aborted && abort.signal.reason !== "timeout"
          ? "search_cancelled"
          : "search_failed",
        {
          elapsedMs: Math.round(performance.now() - started),
          status:
            abort.signal.aborted && abort.signal.reason !== "timeout"
              ? "cancelled"
              : "error",
        },
        researchSessionId,
      );
      if (abort.signal.aborted) {
        setError(
          abort.signal.reason === "timeout"
            ? t(
                "ค้นหานานเกินไป ลองระบุวัสดุให้ชัดขึ้นแล้วค้นใหม่",
                "Search timed out. Try a more specific query.",
              )
            : t("ยกเลิกการค้นหาแล้ว", "Search cancelled."),
        );
      } else
        setError(
          e instanceof Error
            ? e.message
            : t("ค้นหาไม่สำเร็จ", "Search failed."),
        );
    } finally {
      clearTimeout(timer);
      if (!abort.signal.aborted) void refreshLimits();
      if (controller.current === abort) {
        setBusy(false);
        controller.current = null;
      }
    }
  }

  function download() {
    if (!visible) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ request, result: visible }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `rebuild-web-projects-${visible.searchedAt.slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="web-discovery">
      <div className="web-discovery-heading">
        <span className="eyebrow">
          <Globe2 size={18} />{" "}
          {t("ไอเดียจากอินเทอร์เน็ต", "IDEAS FROM THE WEB")}
        </span>
        <h1>
          {t("ของที่มี ทำอะไรได้อีก?", "What else can your materials become?")}
        </h1>
        <p>
          {t(
            "เลือกวัสดุหลายชิ้น แล้วค้นหาคู่มือ DIY จากเว็บไซต์ภายนอก แม้วัสดุหรือโปรเจกต์นั้นยังไม่มีใน ReBuild",
            "Choose a group of materials to find DIY tutorials on other websites, including materials and projects outside ReBuild’s catalogue.",
          )}
        </p>
      </div>
      <form
        className="web-search-form panel stack"
        onSubmit={(e) => void search(e)}
      >
        <fieldset disabled={busy}>
          <legend>
            {t("1. เลือกวัสดุที่อยากใช้", "1. Choose materials to use")}
          </legend>
          <div className="button-row">
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setSelected(inventory.slice(0, 30).map((i) => i.id))
              }
            >
              {t("เลือกทั้งหมด (สูงสุด 30)", "Select all (up to 30)")}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => setSelected([])}
            >
              {t("ล้างการเลือก", "Clear selection")}
            </button>
            <span>
              {t(
                `เลือก ${chosen.length}/30 รายการ`,
                `${chosen.length}/30 selected`,
              )}
            </span>
          </div>
          {inventory.length > 0 ? (
            <>
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label={t(
                    "ค้นหาในวัสดุที่จะเลือก",
                    "Filter materials to select",
                  )}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t(
                    "ค้นหาชื่อของในคลัง",
                    "Find a material in your inventory",
                  )}
                />
              </label>
              <div className="web-material-picker">
                {filtered.map((i) => (
                  <label className="web-material-option" key={i.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(i.id)}
                      disabled={!selected.includes(i.id) && chosen.length >= 30}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [
                                ...ids.filter((id) =>
                                  inventory.some((item) => item.id === id),
                                ),
                                i.id,
                              ]
                            : ids.filter((id) => id !== i.id),
                        )
                      }
                    />
                    <span>
                      <strong>{i.label}</strong>
                      <small>
                        {i.quantity} {unitText(i.unit, language)}
                        {i.condition !== "usable" &&
                          ` · ${i.condition === "damaged" ? t("ชำรุด", "damaged") : t("ยังไม่ตรวจสภาพ", "condition unchecked")}`}
                      </small>
                    </span>
                  </label>
                ))}
                {!filtered.length && (
                  <p>{t("ไม่พบชื่อที่ค้นหา", "No matching names.")}</p>
                )}
              </div>
            </>
          ) : (
            <p>
              {t(
                "คลังยังว่าง พิมพ์วัสดุในช่องด้านล่างได้ หรือ",
                "Your inventory is empty. Describe your materials below, or",
              )}{" "}
              <a href="#/inventory">{t("เพิ่มของในคลัง", "add materials")}</a>
            </p>
          )}
          <label className="web-query">
            {t(
              "2. วัสดุอื่นและสิ่งที่อยากทำ (ไม่บังคับถ้าเลือกของแล้ว)",
              "2. Other materials and your goal (optional if materials are selected)",
            )}
            <textarea
              rows={3}
              maxLength={2000}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "เช่น มีกระดาษ เทปกาว และดินสอ อยากทำของเล่นวิทยาศาสตร์ง่าย ๆ โดยไม่ซื้อของเพิ่ม",
                "For example: paper, tape and a pencil. Find a simple science toy without buying extra supplies.",
              )}
            />
          </label>
          <details className="web-search-preferences">
            <summary>{t("ปรับเงื่อนไขการค้นหา", "Search preferences")}</summary>
            <div className="web-preference-grid">
              <label>
                {t("ระดับความยากที่ต้องการ", "Preferred difficulty")}
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as SearchDraft["difficulty"])
                  }
                >
                  <option value="any">{t("ไม่จำกัด", "Any")}</option>
                  <option value="beginner">
                    {t("ผู้เริ่มต้น", "Beginner")}
                  </option>
                  <option value="intermediate">
                    {t("ปานกลาง", "Intermediate")}
                  </option>
                </select>
              </label>
              <label>
                {t("เวลาที่มี (นาที)", "Available time (minutes)")}
                <input
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  placeholder={t("ไม่กำหนด", "No preference")}
                  value={maxMinutes}
                  onChange={(e) => setMaxMinutes(e.target.value)}
                />
              </label>
              <label>
                {t("งบซื้อเพิ่ม (บาท)", "Extra supply budget (THB)")}
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  placeholder={t("ไม่กำหนด", "No preference")}
                  value={maxBudgetThb}
                  onChange={(e) => setMaxBudgetThb(e.target.value)}
                />
              </label>
              <label>
                {t("การใช้ของเพิ่มเติม", "Additional supplies")}
                <select
                  value={additionalSupplies}
                  onChange={(e) =>
                    setAdditionalSupplies(
                      e.target.value as SearchDraft["additionalSupplies"],
                    )
                  }
                >
                  <option value="allow">
                    {t("ยอมเพิ่มของที่ขาด", "Allow extra supplies")}
                  </option>
                  <option value="avoid">
                    {t("เน้นใช้ของที่มี", "Prefer only what I have")}
                  </option>
                </select>
              </label>
            </div>
            <p className="form-hint">
              {t(
                "เงื่อนไขนี้ช่วยกำหนดการค้นหา เวลา ราคา และความพร้อมจริงยังต้องตรวจจากต้นฉบับและวัสดุของคุณ",
                "These preferences guide the search. Actual time, prices and material suitability still need checking against the original tutorial and your supplies.",
              )}
            </p>
          </details>
        </fieldset>
        {draftError && (
          <div className="notice" role="status">
            <p>
              {t(
                "บันทึกข้อความร่างในแท็บนี้ไม่ได้ ข้อมูลเดิมที่อ่านไม่สำเร็จยังไม่ถูกทับ คุณยังค้นหาได้",
                "The search draft could not be saved in this tab. Unreadable existing data has not been overwritten. You can still search.",
              )}
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                try {
                  sessionStorage.removeItem(WEB_DRAFT_KEY);
                  setDraftError(false);
                } catch {
                  setDraftError(true);
                }
              }}
            >
              {t("เริ่มบันทึกข้อความร่างใหม่", "Reset draft storage")}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                try {
                  downloadSearchRecovery("draft");
                } catch {
                  setError(
                    t(
                      "ดาวน์โหลดร่างเดิมไม่ได้ เบราว์เซอร์อาจไม่อนุญาตให้อ่านข้อมูล",
                      "Could not download the original draft; browser storage may be unavailable.",
                    ),
                  );
                }
              }}
            >
              {t(
                "ดาวน์โหลดร่างเดิมเพื่อกู้ข้อมูล",
                "Download original draft for recovery",
              )}
            </button>
          </div>
        )}
        <p className="form-hint">
          {t(
            "เมื่อกดค้นหา ชื่อ จำนวน สภาพ สเปกของวัสดุที่เลือก และข้อความนี้จะส่งให้ OpenAI เพื่อค้นเว็บ ใช้โควตา AI รูปและบันทึกส่วนตัวไม่ถูกส่งไป",
            "Searching sends selected material names, quantities, conditions, specifications and this text to OpenAI for web search. It uses the AI allowance; local photos and private notes are excluded.",
          )}
        </p>
        <p className="form-hint">
          {t(
            "ข้อความร่างจำไว้เฉพาะแท็บนี้ ผลที่ต้องการเก็บให้กดบันทึกโปรเจกต์ ข้อมูลวิจัยจะบันทึกเฉพาะเมื่อคุณยินยอมในหน้าการทดสอบ",
            "Drafts are remembered in this tab. Save a project to keep it. Research events are recorded only after consent on the research page.",
          )}{" "}
          <a href="#/research">
            {t("การทดสอบสำหรับงานวิจัย", "Research participation")}
          </a>
        </p>
        {limits && (
          <p className="web-limits">
            {!limits.webSearchEnabled
              ? t(
                  "การค้นเว็บถูกปิดชั่วคราว",
                  "Web search is temporarily disabled.",
                )
              : t(
                  `ค้นหาใหม่ได้อีกไม่เกิน ${limits.webSearchRemaining} ครั้งตามโควตาปัจจุบัน`,
                  `Up to ${limits.webSearchRemaining} new searches remain under the current allowance.`,
                )}{" "}
            {t("เริ่มรอบใหม่ ", "Resets ")}
            {new Date(limits.resetsAt).toLocaleString(
              language === "th" ? "th-TH" : "en-GB",
            )}
            <br />
            <small>
              {t(
                "โควตาใช้ร่วมกับผู้ใช้อื่น ผลเดิมที่ยังอยู่ในแคชอาจเปิดซ้ำได้โดยไม่ใช้โควตาค้นใหม่",
                "Some allowances are shared. A still-cached identical result may be reused without a new search allowance.",
              )}
            </small>
          </p>
        )}
        <div className="button-row">
          <button
            className="primary"
            disabled={busy || (!chosen.length && !query.trim())}
            type="submit"
          >
            <Globe2 size={18} />
            {busy
              ? t("กำลังค้นเว็บ…", "Searching the web…")
              : t("ค้นหาโปรเจกต์จากอินเทอร์เน็ต", "Find projects on the web")}
          </button>
          {busy && (
            <button
              className="secondary"
              type="button"
              onClick={() => controller.current?.abort()}
            >
              {t("ยกเลิก", "Cancel")}
            </button>
          )}
        </div>
        {busy && (
          <p role="status">
            <LoaderCircle size={18} className="spinner" />{" "}
            {t(
              "ส่งคำขอแล้ว กำลังรอผลค้นหาและสรุปข้อมูล อาจใช้เวลาประมาณหนึ่งถึงสองนาที",
              "Request sent. Waiting for search and summary results; this may take one to two minutes.",
            )}
            <span aria-live="off">
              {" "}
              {t(`รอแล้ว ${elapsed} วินาที`, `${elapsed} seconds elapsed`)}
            </span>
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </form>
      {result && !visible && (
        <p className="notice" role="status">
          {t(
            "วัสดุหรือข้อความเปลี่ยนแล้ว กดค้นหาเพื่อเทียบกับรายการใหม่",
            "Your materials or query changed. Search again to match the new selection.",
          )}
        </p>
      )}
      {visible && (
        <section
          className="web-results"
          aria-label={t("ผลค้นหาจากอินเทอร์เน็ต", "Web project results")}
        >
          <div className="web-results-heading">
            <div>
              <h2>
                {t("โปรเจกต์จากเว็บไซต์ภายนอก", "Projects from other websites")}
              </h2>
              <p>
                {t("ค้นเมื่อ ", "Searched ")}
                {new Date(visible.searchedAt).toLocaleString(
                  language === "th" ? "th-TH" : "en-GB",
                )}
              </p>
            </div>
            <button className="secondary" onClick={download}>
              <Download size={17} />
              {t("ดาวน์โหลดผลค้นหา", "Download results")}
            </button>
          </div>
          {result?.cached && (
            <p className="notice" role="status">
              {t(
                "ใช้ผลค้นหาเดิมในเซสชันนี้ ไม่มีการเรียกค้นหาใหม่",
                "Reused this session’s cached result; no new search was made.",
              )}
              {result.cacheExpires && (
                <>
                  {" "}
                  {t("เก็บชั่วคราวถึง ", "Cached until ")}
                  {new Date(result.cacheExpires).toLocaleTimeString(
                    language === "th" ? "th-TH" : "en-GB",
                  )}
                </>
              )}
            </p>
          )}
          <p>{visible.summary}</p>
          {visible.projects.length > 1 && (
            <div
              className="web-compare"
              role="region"
              aria-label={t("เปรียบเทียบผลค้นหา", "Compare search results")}
              tabIndex={0}
            >
              <table>
                <caption>
                  {t(
                    "เปรียบเทียบรายการที่ AI พบ — ยังต้องตรวจสเปก",
                    "Compare AI results — specifications still need checking",
                  )}
                </caption>
                <thead>
                  <tr>
                    <th>{t("โปรเจกต์", "Project")}</th>
                    <th>{t("รายการวัสดุที่อาจตรง", "Potential matches")}</th>
                    <th>{t("รายการที่ยังไม่พบ", "Not matched")}</th>
                    <th>{t("จำนวนขั้นตอน", "Steps")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.projects.map((p, i) => (
                    <tr key={`${p.sourceId}-${i}`}>
                      <th scope="row">
                        <a
                          href={`#web-project-${i}`}
                          onClick={(e) => {
                            e.preventDefault();
                            document
                              .getElementById(`web-project-${i}`)
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          {p.title}
                        </a>
                      </th>
                      <td>
                        {
                          p.materials.filter((m) => m.inventoryIds.length > 0)
                            .length
                        }
                      </td>
                      <td>
                        {
                          p.materials.filter((m) => !m.inventoryIds.length)
                            .length
                        }
                      </td>
                      <td>{p.steps.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="notice">
            {t(
              "สรุปและเทียบวัสดุโดย AI จากแหล่งอ้างอิงที่ค้นพบ ยังไม่ใช่คู่มือที่ทีม ReBuild ทดลองทำแล้ว ตรวจจำนวน ขนาด สภาพ และอ่านต้นฉบับก่อนลงมือ",
              "AI summaries and material comparisons from retrieved sources. These builds have not been tested by ReBuild. Check quantities, dimensions and condition, and read the original tutorial before starting.",
            )}
          </p>
          {!visible.projects.length && (
            <p role="status">
              {t(
                "ยังไม่พบโปรเจกต์ที่มีแหล่งข้อมูลและขั้นตอนเพียงพอ ลองเปลี่ยนวัสดุหรือระบุสิ่งที่อยากทำเพิ่ม",
                "No projects had enough supporting source and method information. Try different materials or a more specific goal.",
              )}
            </p>
          )}
          {visible.projects.map((project, i) => (
            <ExternalProject
              key={`${project.sourceId}-${i}`}
              project={project}
              sources={visible.sources}
              inventory={chosen}
              result={visible}
              request={request}
              index={i}
            />
          ))}
        </section>
      )}
      <details className="panel web-feedback-tools">
        <summary>
          {t(
            "จัดการข้อเสนอแนะที่บันทึกในเครื่อง",
            "Manage feedback saved on this browser",
          )}
        </summary>
        <p>
          {t(
            "ข้อเสนอแนะยังไม่ได้ส่งให้ผู้ดูแล คุณดาวน์โหลดส่งให้ผู้วิจัยเองได้ อย่าใส่ข้อมูลส่วนตัว",
            "Feedback has not been sent to the maintainer. Download it to share with the researcher yourself. Avoid personal information.",
          )}
        </p>
        <div className="button-row">
          <button
            className="secondary"
            onClick={() => {
              try {
                downloadWebFeedback();
                setFeedbackRecovery(false);
                setFeedbackNotice("");
              } catch {
                setFeedbackRecovery(true);
                setFeedbackNotice(
                  t(
                    "อ่านข้อเสนอแนะไม่สำเร็จ ข้อมูลเดิมยังอยู่",
                    "Could not read feedback; existing data is preserved.",
                  ),
                );
              }
            }}
          >
            {t("ดาวน์โหลดข้อเสนอแนะ", "Download feedback")}
          </button>
          <button
            className="text-link"
            onClick={() => {
              if (
                !window.confirm(
                  t(
                    "ลบข้อเสนอแนะทั้งหมดในเบราว์เซอร์นี้?",
                    "Delete all feedback on this browser?",
                  ),
                )
              )
                return;
              try {
                localStorage.removeItem(WEB_FEEDBACK_KEY);
                setFeedbackRecovery(false);
                setFeedbackNotice(t("ลบข้อเสนอแนะแล้ว", "Feedback deleted."));
              } catch {
                setFeedbackNotice(
                  t("ลบไม่สำเร็จ", "Could not delete feedback."),
                );
              }
            }}
          >
            {t("ลบข้อเสนอแนะทั้งหมด", "Delete all feedback")}
          </button>
        </div>
        {feedbackNotice && <p role="status">{feedbackNotice}</p>}
        {feedbackRecovery && (
          <button
            className="secondary"
            onClick={() => {
              try {
                downloadSearchRecovery("feedback");
              } catch {
                setFeedbackNotice(
                  t(
                    "ดาวน์โหลดข้อมูลเดิมไม่ได้ เบราว์เซอร์อาจไม่อนุญาตให้อ่านข้อมูล",
                    "Could not download original data; browser storage may be unavailable.",
                  ),
                );
              }
            }}
          >
            {t(
              "ดาวน์โหลดข้อมูลเดิมเพื่อกู้ข้อมูล",
              "Download original data for recovery",
            )}
          </button>
        )}
      </details>
    </div>
  );
}

function SourceLinks({
  ids,
  sources,
}: {
  ids: string[];
  sources: WebSource[];
}) {
  const { t } = useLanguage();
  return (
    <span className="web-citations">
      {ids.map((id) => {
        const source = sources.find((s) => s.id === id);
        return source ? (
          <a
            key={id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
          >
            {t("แหล่งข้อมูล", "Source")} {id.slice(1)}{" "}
            <ArrowUpRight size={12} />
          </a>
        ) : null;
      })}
    </span>
  );
}

function ExternalProject({
  project: p,
  sources,
  inventory,
  result,
  request,
  index,
}: {
  project: WebProject;
  sources: WebSource[];
  inventory: InventoryItem[];
  result: WebSearchResult;
  request: WebSearchRequest;
  index: number;
}) {
  const { t, language } = useLanguage();
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [feedbackOutcome, setFeedbackOutcome] =
    useState<WebFeedback["outcome"]>("useful");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const source = sources.find((s) => s.id === p.sourceId);
  if (!source) return null;
  const labels = (ids: string[]) =>
    inventory
      .filter((i) => ids.includes(i.id))
      .map((i) => `${i.label} (${i.quantity} ${unitText(i.unit, language)})`)
      .join(", ");
  const linkGroup = (ids: string[], empty: string) =>
    ids.length ? (
      <ul>
        {ids.map((id) => {
          const s = sources.find((s) => s.id === id);
          return s ? (
            <li key={id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title} <ArrowUpRight size={14} />
              </a>
            </li>
          ) : null;
        })}
      </ul>
    ) : (
      <p className="muted">{empty}</p>
    );
  return (
    <article className="web-project-card" id={`web-project-${index}`}>
      <div className="web-project-top">
        <span className="eyebrow">{new URL(source.url).hostname}</span>
        <h3>{p.title}</h3>
        <p>{p.summary}</p>
        <a
          className="primary"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            recordResearchEvent("project_opened", { target: "source" })
          }
        >
          {t("เปิดคู่มือต้นฉบับ", "Open original tutorial")}{" "}
          <ArrowUpRight size={17} />
        </a>
        <div className="button-row web-save-actions">
          <button
            className="secondary"
            onClick={() => {
              try {
                const saved = saveExternalPlan(p, result, request);
                setSaveError(false);
                setSaveNotice(
                  saved.searchedAt !== result.searchedAt
                    ? t(
                        "มีแผนนี้อยู่แล้ว เก็บคู่มือและความคืบหน้าฉบับเดิมไว้ เปิดตรวจได้ที่งานที่บันทึก",
                        "This plan is already saved. Its earlier tutorial and progress were kept; review it in Saved builds.",
                      )
                    : t(
                        "บันทึกในเบราว์เซอร์นี้แล้ว เปิดได้ที่งานที่บันทึก",
                        "Saved on this browser. Reopen it from Saved builds.",
                      ),
                );
                recordResearchEvent("project_saved");
              } catch {
                setSaveError(true);
                setSaveNotice(
                  t(
                    "บันทึกไม่สำเร็จ พื้นที่อาจเต็มหรือข้อมูลเดิมอ่านไม่ได้ ดาวน์โหลดผลค้นหาไว้ก่อน",
                    "Could not save. Storage may be full or existing data unreadable. Download the search results first.",
                  ),
                );
              }
            }}
          >
            <BookmarkPlus size={17} />
            {t("บันทึกโปรเจกต์นี้", "Save this project")}
          </button>
          <a href="#/builds" className="text-link">
            {t("เปิดงานที่บันทึก", "Open saved builds")}
          </a>
        </div>
        {saveNotice && (
          <p
            className={saveError ? "notice error" : "notice"}
            role={saveError ? "alert" : "status"}
          >
            {saveNotice}
          </p>
        )}
      </div>
      <p className="web-fit">
        <strong>
          {t("เหมาะกับของที่เลือกอย่างไร: ", "How it fits your materials: ")}
        </strong>
        {p.fit}
      </p>
      <details open>
        <summary>
          {t("วัสดุที่ใช้และของที่ยังขาด", "Materials and missing supplies")}
        </summary>
        <p className="form-hint">
          {t(
            "รายการที่ AI เทียบว่ามี ต้องตรวจจำนวน สภาพ และสเปกอีกครั้ง วัสดุในข้อความเพิ่มเติมอาจยังแสดงว่าไม่พบในคลัง",
            "AI matches still need quantity, condition and specification checks. Materials mentioned only in your text may appear as absent from the inventory.",
          )}
        </p>
        <ul className="web-requirements">
          {p.materials.map((m, i) => (
            <li key={i}>
              <div>
                <strong>{m.name}</strong> —{" "}
                {!m.amount.trim() ||
                /^(unknown|unspecified|not specified)$/i.test(m.amount.trim())
                  ? t(
                      "ต้นฉบับไม่ระบุจำนวน",
                      "Quantity not specified by the source",
                    )
                  : m.amount}
              </div>
              <span
                className={m.inventoryIds.length ? "web-match" : "web-missing"}
              >
                {m.inventoryIds.length
                  ? `${t("ดูเหมือนมีในคลัง: ", "Potential inventory match: ")}${labels(m.inventoryIds)}`
                  : t(
                      "ยังไม่พบในวัสดุที่เลือก",
                      "Not found in selected inventory",
                    )}
              </span>
              {m.inventoryIds.length > 0 && (
                <small className="web-check-label">
                  {t(
                    "ยังต้องตรวจจำนวน ขนาด สเปก และสภาพก่อนใช้",
                    "Check quantity, size, specifications and condition before use.",
                  )}
                </small>
              )}
              {m.note && <p>{m.note}</p>}
              <SourceLinks ids={m.sourceIds} sources={sources} />
            </li>
          ))}
        </ul>
      </details>
      <details open>
        <summary>{t("วิธีทำโดยสรุป", "Method summary")}</summary>
        <ol className="web-steps">
          {p.steps.map((step, i) => (
            <li key={i}>
              {step.text}
              <SourceLinks ids={step.sourceIds} sources={sources} />
            </li>
          ))}
        </ol>
      </details>
      <details>
        <summary>{t("ใช้อะไรทดแทนได้บ้าง", "Possible substitutions")}</summary>
        {p.substitutions.length ? (
          <ul>
            {p.substitutions.map((s, i) => (
              <li key={i}>
                <strong>
                  {s.missing} → {s.alternative}
                </strong>
                <p>{s.conditions}</p>
                {s.inventoryIds.length > 0 && (
                  <p>
                    {t("ของที่เลือก: ", "Selected items: ")}
                    {labels(s.inventoryIds)}
                  </p>
                )}
                {s.sourceIds.length ? (
                  <SourceLinks ids={s.sourceIds} sources={sources} />
                ) : (
                  <small>
                    {t(
                      "ข้อเสนอของ AI ยังไม่มีแหล่งยืนยันหรือผลทดลอง",
                      "AI suggestion; no supporting source or physical test.",
                    )}
                  </small>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {t(
              "ยังไม่มีข้อมูลเพียงพอให้แนะนำวัสดุทดแทนสำหรับโปรเจกต์นี้",
              "Not enough evidence to suggest substitutions for this project.",
            )}
          </p>
        )}
      </details>
      <div className="web-resource-columns">
        <section>
          <h4>{t("วิดีโอที่เกี่ยวข้อง", "Related videos")}</h4>
          {linkGroup(
            p.videoSourceIds,
            t(
              "การค้นครั้งนี้ยังไม่พบลิงก์วิดีโอที่ยืนยันแหล่งได้",
              "No supported video link found in this search.",
            ),
          )}
          <a
            className="text-link"
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${p.title} DIY tutorial`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(
              "เปิดผลค้นหาวิดีโอเพิ่มเติมบน YouTube",
              "Search for more videos on YouTube",
            )}{" "}
            <ArrowUpRight size={14} />
          </a>
        </section>
        <section>
          <h4>
            {t(
              "ลิงก์วัสดุและสินค้าที่ค้นพบ",
              "Discovered material and product links",
            )}
          </h4>
          {linkGroup(
            p.shoppingSourceIds,
            t(
              "การค้นครั้งนี้ยังไม่พบลิงก์สินค้าที่เกี่ยวข้อง",
              "No relevant product link found in this search.",
            ),
          )}
          {p.shoppingSourceIds.length > 0 && (
            <small>
              {t(
                "ตรวจสเปก ราคา และสินค้าคงเหลือกับผู้ขาย",
                "Check specifications, prices and availability with the seller.",
              )}
            </small>
          )}
          {p.materials.some((m) => !m.inventoryIds.length) && (
            <>
              <p>
                {t(
                  "เปิดผลค้นหาร้านค้าสำหรับของที่ขาด:",
                  "Search the web for missing supplies:",
                )}
              </p>
              <ul>
                {p.materials
                  .filter((m) => !m.inventoryIds.length)
                  .map((m, i) => (
                    <li key={i}>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${m.name} ${language === "th" ? "ซื้อ" : "buy"}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("ค้นหา ", "Search for ")}
                        {m.name} <ArrowUpRight size={14} />
                      </a>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <details className="web-result-feedback">
        <summary>
          <MessageSquare size={17} />{" "}
          {t("ให้ข้อเสนอแนะเกี่ยวกับผลนี้", "Give feedback on this result")}
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              saveWebFeedback({
                sourceUrl: source.url,
                projectTitle: p.title,
                searchedAt: result.searchedAt,
                outcome: feedbackOutcome,
                note: feedbackNote,
              });
              recordResearchEvent("result_feedback", {
                outcome: feedbackOutcome,
              });
              setFeedbackNote("");
              setFeedbackNotice(
                t(
                  "บันทึกในเบราว์เซอร์นี้แล้ว ยังไม่ได้ส่งให้ผู้ดูแล",
                  "Saved on this browser; not sent to the maintainer.",
                ),
              );
            } catch {
              setFeedbackNotice(
                t(
                  "บันทึกข้อเสนอแนะไม่สำเร็จ ข้อมูลเดิมยังอยู่ ลองดาวน์โหลดก่อนลบข้อมูล",
                  "Could not save feedback. Existing data is preserved; download it before clearing storage.",
                ),
              );
            }
          }}
          className="stack"
        >
          <label>
            {t("ความคิดเห็นต่อผลค้นหา", "Feedback category")}
            <select
              value={feedbackOutcome}
              onChange={(e) =>
                setFeedbackOutcome(e.target.value as WebFeedback["outcome"])
              }
            >
              <option value="useful">{t("มีประโยชน์", "Useful")}</option>
              <option value="materials_mismatch">
                {t("วัสดุไม่ตรง", "Materials do not match")}
              </option>
              <option value="broken_link">
                {t("ลิงก์เปิดไม่ได้", "Link does not work")}
              </option>
              <option value="other">{t("อื่น ๆ", "Other")}</option>
            </select>
          </label>
          <label>
            {t(
              "รายละเอียดเพิ่มเติม (ไม่ต้องใส่ชื่อหรือข้อมูลส่วนตัว)",
              "Optional details (no names or personal information)",
            )}
            <textarea
              rows={2}
              maxLength={500}
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
            />
          </label>
          <button className="secondary" type="submit">
            {t("บันทึกข้อเสนอแนะในเครื่อง", "Save feedback on this browser")}
          </button>
          {feedbackNotice && <p role="status">{feedbackNotice}</p>}
        </form>
      </details>
      {p.cautions.length > 0 && (
        <aside className="notice">
          <strong>
            {t("สิ่งที่ต้องตรวจและข้อควรระวัง", "Checks and cautions")}
          </strong>
          <ul>
            {p.cautions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
