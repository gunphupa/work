import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Download,
  Globe2,
  LoaderCircle,
  Search,
} from "lucide-react";
import { useLanguage, unitText } from "../i18n";
import type { InventoryItem } from "../domain/schema";
import {
  searchMaterialsPayload,
  webSearchResultSchema,
  type WebSearchResult,
  type WebSource,
  type WebProject,
} from "../domain/web-projects";

export function WebProjects({ inventory }: { inventory: InventoryItem[] }) {
  const { t, language } = useLanguage();
  const [selected, setSelected] = useState(() =>
    inventory.slice(0, 30).map((i) => i.id),
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    signature: string;
    data: WebSearchResult;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const chosen = inventory.filter((i) => selected.includes(i.id));
  const request = {
    language,
    query: query.trim(),
    materials: searchMaterialsPayload(chosen),
  };
  const signature = JSON.stringify(request);
  const visible = result?.signature === signature ? result.data : null;
  const filtered = inventory.filter((i) =>
    i.label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
  );
  useEffect(() => () => controller.current?.abort(), []);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setResult(null);
    const timer = setTimeout(() => abort.abort("timeout"), 100000);
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
      if (!abort.signal.aborted) setResult({ signature, data: parsed });
    } catch (e) {
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
                            ? [...ids, i.id]
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
        </fieldset>
        <p className="form-hint">
          {t(
            "เมื่อกดค้นหา ชื่อ จำนวน สภาพ สเปกของวัสดุที่เลือก และข้อความนี้จะส่งให้ OpenAI เพื่อค้นเว็บ ใช้โควตา AI รูปและบันทึกส่วนตัวไม่ถูกส่งไป",
            "Searching sends selected material names, quantities, conditions, specifications and this text to OpenAI for web search. It uses the AI allowance; local photos and private notes are excluded.",
          )}
        </p>
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
              "กำลังค้นหาแหล่งข้อมูลและเทียบวัสดุ อาจใช้เวลาประมาณหนึ่งนาที",
              "Finding sources and comparing materials. This may take about a minute.",
            )}
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
          <p>{visible.summary}</p>
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
            />
          ))}
        </section>
      )}
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
}: {
  project: WebProject;
  sources: WebSource[];
  inventory: InventoryItem[];
}) {
  const { t, language } = useLanguage();
  const source = sources.find((s) => s.id === p.sourceId)!;
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
    <article className="web-project-card">
      <div className="web-project-top">
        <span className="eyebrow">{new URL(source.url).hostname}</span>
        <h3>{p.title}</h3>
        <p>{p.summary}</p>
        <a
          className="primary"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("เปิดคู่มือต้นฉบับ", "Open original tutorial")}{" "}
          <ArrowUpRight size={17} />
        </a>
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
                <strong>{m.name}</strong> — {m.amount}
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
        </section>
      </div>
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
