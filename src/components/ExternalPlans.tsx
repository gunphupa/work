import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import { useLanguage, unitText } from "../i18n";
import type { InventoryItem } from "../domain/schema";
import { recordResearchEvent } from "../domain/research";
import {
  EXTERNAL_PLANS_EVENT,
  EXTERNAL_PLANS_KEY,
  EXTERNAL_PLANS_MAX_BYTES,
  ExternalPlanStorageError,
  deleteExternalPlan,
  downloadExternalPlans,
  importExternalPlans,
  readExternalPlans,
  updateExternalPlan,
  type ExternalPlan,
} from "../domain/external-plans";
import { ExternalProjectHelp } from "./ExternalProjectHelp";
import "./external-plans.css";

type NoteDraft = { value: string; baseline: string };
const noteDrafts = new Map<string, NoteDraft>();
const draftKey = (id: string) => `rebuild.external-plan-draft.${id}`;
function readNoteDraft(id: string): NoteDraft | undefined {
  if (noteDrafts.has(id)) return noteDrafts.get(id);
  try {
    const raw = sessionStorage.getItem(draftKey(id));
    if (!raw || raw.length > 50000) return;
    const value = JSON.parse(raw);
    if (
      typeof value.value === "string" &&
      value.value.length <= 10000 &&
      typeof value.baseline === "string" &&
      value.baseline.length <= 10000
    )
      return value;
  } catch {
    /* Memory preserves drafts during navigation if browser storage is blocked. */
  }
}
function retainNoteDraft(id: string, draft?: NoteDraft) {
  if (draft) noteDrafts.set(id, draft);
  else noteDrafts.delete(id);
  try {
    if (draft) sessionStorage.setItem(draftKey(id), JSON.stringify(draft));
    else sessionStorage.removeItem(draftKey(id));
  } catch {
    /* The primary save error remains visible; do not lose the in-memory draft. */
  }
}

export function ExternalPlans({ inventory }: { inventory: InventoryItem[] }) {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<ExternalPlan[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const report = (error: unknown) => {
    const reason =
      error instanceof ExternalPlanStorageError ? error.reason : "invalid";
    setError(
      reason === "full"
        ? t(
            "พื้นที่แผนเต็มหรือไฟล์ใหญ่เกิน 2 MB ส่งออกข้อมูลแล้วลบบางแผนก่อนเพิ่ม",
            "Plan storage is full or the file exceeds 2 MB. Export a backup and remove some plans first.",
          )
        : reason === "unavailable"
          ? t(
              "บันทึกแผนไม่ได้ ตรวจพื้นที่ว่างและสิทธิ์จัดเก็บของเบราว์เซอร์ ข้อมูลเดิมไม่ได้ถูกลบ",
              "Could not save plans. Check browser storage space and permissions. Existing data has not been deleted.",
            )
          : t(
              "อ่านข้อมูลแผนไม่ได้หรือไฟล์ไม่ถูกต้อง ข้อมูลเดิมยังอยู่และไม่ได้ถูกเขียนทับ",
              "Could not read plans or the file is invalid. Existing data is preserved and has not been overwritten.",
            ),
    );
  };
  useEffect(() => {
    const refresh = () => {
      try {
        setPlans(readExternalPlans().plans);
        setError("");
      } catch {
        setError(
          t(
            "อ่านข้อมูลแผนไม่ได้ ข้อมูลเดิมยังอยู่และไม่ได้ถูกเขียนทับ",
            "Could not read plans. Existing data is preserved and has not been overwritten.",
          ),
        );
      }
    };
    const changed = (event: StorageEvent) => {
      if (event.key === EXTERNAL_PLANS_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener(EXTERNAL_PLANS_EVENT, refresh);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener(EXTERNAL_PLANS_EVENT, refresh);
      window.removeEventListener("storage", changed);
    };
  }, [t]);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > EXTERNAL_PLANS_MAX_BYTES)
        throw new ExternalPlanStorageError("full");
      const count = importExternalPlans(await file.text());
      setError("");
      setNotice(
        t(
          `เพิ่ม ${count} แผนแล้ว แผนเดิมและความคืบหน้าไม่ถูกแทนที่`,
          `Added ${count} plans. Existing plans and progress were kept.`,
        ),
      );
    } catch (error) {
      report(error);
    }
  }
  const active = plans.find((plan) => plan.id === activeId);
  return (
    <section
      className="external-plans stack"
      aria-labelledby="external-plans-heading"
    >
      <div className="external-plan-heading">
        <div>
          <h2 id="external-plans-heading">
            {t("แผนจากอินเทอร์เน็ต", "Saved web projects")}
          </h2>
          <p>
            {t(
              "เก็บในเบราว์เซอร์นี้ แยกจากไฟล์สำรองคลังวัสดุ ส่งออกแผนเพื่อย้ายเครื่องหรือสำรองข้อมูล",
              "Stored in this browser, separately from your inventory backup. Export these plans to back them up or move them to another device.",
            )}
          </p>
        </div>
        <div className="button-row external-plan-controls">
          <button
            type="button"
            className="secondary"
            disabled={!plans.length}
            onClick={() => {
              try {
                downloadExternalPlans(plans);
              } catch (error) {
                report(error);
              }
            }}
          >
            <Download size={16} />
            {t("ส่งออกแผน", "Export web plans")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            {t("นำเข้าแผน", "Import web plans")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label={t(
              "ไฟล์สำรองแผนจากอินเทอร์เน็ต",
              "Web plans backup file",
            )}
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {active ? (
        <PlanDetail
          key={active.id}
          plan={active}
          inventory={inventory}
          back={() => setActiveId(null)}
          report={report}
          remove={() => {
            if (
              !confirm(
                t(
                  "ลบแผนนี้พร้อมความคืบหน้าและบันทึก? ส่งออกก่อนหากต้องการเก็บไว้",
                  "Delete this plan, progress and notes? Export it first if you want a copy.",
                ),
              )
            )
              return;
            try {
              deleteExternalPlan(active.id);
              retainNoteDraft(active.id);
              setActiveId(null);
              setNotice(t("ลบแผนแล้ว", "Plan deleted."));
            } catch (error) {
              report(error);
            }
          }}
        />
      ) : (
        <>
          {!plans.length && !error && (
            <div className="panel stack">
              <p>
                {t(
                  "ยังไม่มีแผนจากอินเทอร์เน็ต ค้นหาแล้วกดบันทึกบนโปรเจกต์ที่สนใจ",
                  "No web projects saved yet. Search and save a project you want to make.",
                )}
              </p>
              <a className="text-link" href="#/web-projects">
                {t("ค้นหาโปรเจกต์จากอินเทอร์เน็ต", "Find projects on the web")}
              </a>
            </div>
          )}
          <div className="external-plan-grid">
            {plans.map((plan) => (
              <article className="panel stack" key={plan.id}>
                <h3>{plan.project.title}</h3>
                <p>{plan.project.summary}</p>
                <p>
                  {t(
                    `ทำแล้ว ${plan.completed.length}/${plan.project.steps.length} ขั้นตอน`,
                    `${plan.completed.length}/${plan.project.steps.length} steps complete`,
                  )}
                </p>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setActiveId(plan.id);
                    recordResearchEvent("project_opened", {
                      target: "saved_plan",
                    });
                  }}
                >
                  {t("เปิดแผน", "Open plan")} · {plan.project.title}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PlanDetail({
  plan,
  inventory,
  back,
  remove,
  report,
}: {
  plan: ExternalPlan;
  inventory: InventoryItem[];
  back: () => void;
  remove: () => void;
  report: (error: unknown) => void;
}) {
  const { t, language } = useLanguage();
  const [recovered] = useState(() => readNoteDraft(plan.id));
  const [draft, setDraft] = useState(recovered?.value ?? plan.notes);
  const [baseline, setBaseline] = useState(recovered?.baseline ?? plan.notes);
  const [status, setStatus] = useState("");
  const [conflict, setConflict] = useState(false);
  const dirty = draft !== baseline;
  const source = plan.sources.find(
    (source) => source.id === plan.project.sourceId,
  )!;
  const sourceLinks = (ids: string[]) => (
    <span className="external-plan-refs">
      {ids.map((id) => {
        const source = plan.sources.find((source) => source.id === id);
        return source ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            key={id}
          >
            {source.title}
            <ExternalLink size={12} />
          </a>
        ) : null;
      })}
    </span>
  );
  function toggle(
    field: "completed" | "obtained",
    index: number,
    value: boolean,
  ) {
    try {
      const latest = readExternalPlans().plans.find(
        (saved) => saved.id === plan.id,
      );
      if (!latest) throw new ExternalPlanStorageError("missing");
      updateExternalPlan(plan.id, {
        [field]: value
          ? [...new Set([...latest[field], index])]
          : latest[field].filter((i) => i !== index),
      });
      setStatus(t("บันทึกความคืบหน้าแล้ว", "Progress saved."));
    } catch (error) {
      report(error);
    }
  }
  function saveNotes(replace = false) {
    try {
      updateExternalPlan(
        plan.id,
        { notes: draft },
        undefined,
        replace ? undefined : baseline,
      );
      setBaseline(draft);
      retainNoteDraft(plan.id);
      setConflict(false);
      setStatus(t("บันทึกข้อความแล้ว", "Notes saved."));
    } catch (error) {
      if (
        error instanceof ExternalPlanStorageError &&
        error.reason === "conflict"
      )
        setConflict(true);
      else report(error);
    }
  }
  // Remote changes update the visible saved text only when no local draft is being edited.
  const notesValue = !dirty && plan.notes !== baseline ? plan.notes : draft;
  function editNotes(value: string) {
    const expected = dirty ? baseline : plan.notes;
    setDraft(value);
    retainNoteDraft(plan.id, { value, baseline: expected });
    try {
      updateExternalPlan(plan.id, { notes: value }, undefined, expected);
      setBaseline(value);
      retainNoteDraft(plan.id);
      setConflict(false);
      setStatus(t("บันทึกข้อความอัตโนมัติแล้ว", "Notes saved automatically."));
    } catch (error) {
      setBaseline(expected);
      setStatus("");
      if (
        error instanceof ExternalPlanStorageError &&
        error.reason === "conflict"
      )
        setConflict(true);
      else report(error);
    }
  }
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const leave = () => {
    if (
      !dirty ||
      confirm(
        t(
          "ข้อความที่แก้ยังไม่บันทึก ออกจากแผนนี้หรือไม่?",
          "Your edited notes are not saved. Leave this plan?",
        ),
      )
    )
      back();
  };
  return (
    <article className="external-plan-detail panel stack">
      <div className="button-row external-plan-controls">
        <button className="text-link" type="button" onClick={leave}>
          <ArrowLeft size={16} />
          {t("กลับไปรายการแผน", "Back to web plans")}
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            document.body.classList.add("external-plan-print");
            try {
              window.print();
            } finally {
              document.body.classList.remove("external-plan-print");
            }
          }}
        >
          <Printer size={16} />
          {t("พิมพ์แผน", "Print plan")}
        </button>
        <button className="text-link danger" type="button" onClick={remove}>
          <Trash2 size={16} />
          {t("ลบแผนนี้", "Delete this web plan")}
        </button>
      </div>
      <h3>{plan.project.title}</h3>
      <p>{plan.project.summary}</p>
      <a
        className="text-link"
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("เปิดคู่มือต้นฉบับ", "Open original tutorial")}
        <ExternalLink size={15} />
      </a>
      <p className="form-hint">
        {t("บันทึกผลค้นหาเมื่อ", "Search snapshot from")}{" "}
        {new Date(plan.searchedAt).toLocaleString(
          language === "th" ? "th-TH" : "en-GB",
        )}
        .{" "}
        {t(
          "ข้อมูลสรุปโดย AI ตรวจคู่มือและสเปกจริงก่อนทำ แผนนี้ไม่ได้ตรวจสอบว่าคุณสร้างสำเร็จแล้ว",
          "AI summary: check the original guide and actual specifications before building. Checkmarks do not independently verify a successful build.",
        )}
      </p>
      <p>{plan.project.fit}</p>
      <section className="stack">
        <h4>
          {t(
            "วัสดุและรายการที่ต้องเตรียม",
            "Materials and supplies to prepare",
          )}
        </h4>
        <p className="form-hint">
          {t(
            "ติ๊กเมื่อจัดเตรียมหรือซื้อของแล้ว ไม่หักจำนวนหรือเพิ่มของในคลังอัตโนมัติ รายการที่ตรงยังต้องตรวจจำนวนและสเปก",
            "Check supplies after preparing or purchasing them. This does not change inventory quantities. Potential matches still need quantity and specification checks.",
          )}
        </p>
        {plan.project.materials.map((material, index) => {
          const matches = inventory.filter((item) => {
            const snapshot = plan.request.materials.find(
              (saved) => saved.id === item.id,
            );
            return (
              material.inventoryIds.includes(item.id) &&
              item.condition !== "damaged" &&
              snapshot &&
              item.materialId === snapshot.materialId &&
              item.label === snapshot.label &&
              item.unit === snapshot.unit &&
              JSON.stringify(Object.entries(item.specs).sort()) ===
                JSON.stringify(Object.entries(snapshot.specs).sort())
            );
          });
          const unknownAmount =
            /^(unknown|unspecified|not specified)$/i.test(
              material.amount.trim(),
            ) || !material.amount.trim();
          return (
            <div className="external-plan-material" key={index}>
              <label className="external-plan-check">
                <input
                  type="checkbox"
                  checked={plan.obtained.includes(index)}
                  onChange={(event) =>
                    toggle("obtained", index, event.target.checked)
                  }
                />
                <span>
                  <strong>{material.name}</strong> ·{" "}
                  {unknownAmount
                    ? t(
                        "ต้นฉบับไม่ได้ระบุจำนวน",
                        "Quantity not specified by the source",
                      )
                    : material.amount}
                  <small>{t("เตรียมแล้ว", "Prepared / obtained")}</small>
                </span>
              </label>
              <p>
                {matches.length
                  ? t(
                      "อาจใช้ของในคลังได้: ",
                      "Possible current inventory match: ",
                    ) +
                    matches
                      .map(
                        (item) =>
                          `${item.label} (${item.quantity} ${unitText(item.unit, language)})`,
                      )
                      .join(", ")
                  : t(
                      "ไม่พบรายการเดิมที่ชนิดและสเปกตรงกับตอนค้นหา ตรวจของจริงหรือเตรียมเพิ่ม",
                      "No unchanged linked item in your current inventory. Check what you have or prepare this supply.",
                    )}
              </p>
              <p>{material.note}</p>
              {sourceLinks(material.sourceIds)}
              {!matches.length && !plan.obtained.includes(index) && (
                <a
                  className="text-link"
                  href={`https://www.google.com/search?q=${encodeURIComponent(material.name + (language === "th" ? " ซื้อ" : " buy"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t(
                    "ค้นหาสินค้า (ผลค้นหาทั่วไป)",
                    "Search for supplies (general search results)",
                  )}
                </a>
              )}
            </div>
          );
        })}
      </section>
      <section className="stack">
        <h4>{t("ขั้นตอนและความคืบหน้า", "Steps and progress")}</h4>
        <p>
          {t(
            `ทำแล้ว ${plan.completed.length}/${plan.project.steps.length} ขั้นตอน`,
            `${plan.completed.length}/${plan.project.steps.length} steps complete`,
          )}
        </p>
        {plan.project.steps.map((step, index) => (
          <div className="external-plan-step" key={index}>
            <label className="external-plan-check">
              <input
                type="checkbox"
                checked={plan.completed.includes(index)}
                onChange={(event) =>
                  toggle("completed", index, event.target.checked)
                }
              />
              <span>
                {index + 1}. {step.text}
              </span>
            </label>
            {sourceLinks(step.sourceIds)}
          </div>
        ))}
      </section>
      {!!plan.project.substitutions.length && (
        <section className="stack">
          <h4>
            {t("ทางเลือกทดแทนและเงื่อนไข", "Substitutions and conditions")}
          </h4>
          {plan.project.substitutions.map((item, index) => (
            <div key={index}>
              <strong>
                {item.missing} → {item.alternative}
              </strong>
              <p>{item.conditions}</p>
              {item.sourceIds.length ? (
                sourceLinks(item.sourceIds)
              ) : (
                <p className="form-hint">
                  {t(
                    "ข้อเสนอจาก AI ไม่มีแหล่งอ้างอิงรองรับหรือผลทดสอบชิ้นงาน",
                    "AI suggestion; no supporting source or physical test.",
                  )}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
      {!!plan.project.cautions.length && (
        <section>
          <h4>{t("ข้อควรระวัง", "Precautions")}</h4>
          <ul>
            {plan.project.cautions.map((caution, index) => (
              <li key={index}>{caution}</li>
            ))}
          </ul>
        </section>
      )}
      {(!!plan.project.videoSourceIds.length ||
        !!plan.project.shoppingSourceIds.length) && (
        <section className="stack">
          <h4>
            {t("ลิงก์เพิ่มเติมจากผลค้นหา", "Additional links from the search")}
          </h4>
          {sourceLinks([
            ...new Set([
              ...plan.project.videoSourceIds,
              ...plan.project.shoppingSourceIds,
            ]),
          ])}
        </section>
      )}
      <div className="external-plan-controls">
        <ExternalProjectHelp project={plan.project} sources={plan.sources} />
      </div>
      <section className="stack external-plan-notes">
        <p className="form-hint">
          {t(
            "บันทึกข้อความอัตโนมัติในเบราว์เซอร์นี้",
            "Notes save automatically in this browser.",
          )}
        </p>
        <label>
          {t("บันทึกของฉัน", "My project notes")}
          <textarea
            aria-label={t("บันทึกของฉัน", "My project notes")}
            rows={5}
            value={notesValue}
            maxLength={10000}
            onChange={(event) => editNotes(event.target.value)}
          />
        </label>
        <div className="external-plan-controls">
          <button
            className="secondary"
            type="button"
            disabled={!dirty}
            onClick={() => saveNotes()}
          >
            {t("บันทึกข้อความ", "Save notes")}
          </button>
        </div>
        <p className="external-plan-print-notes">{notesValue}</p>
        {conflict && (
          <div role="alert" className="notice">
            <p>
              {t(
                "บันทึกถูกแก้จากอีกแท็บ ข้อความร่างของคุณยังอยู่ เปรียบเทียบก่อนเลือกแทนที่",
                "Another tab changed these notes. Your draft is preserved. Compare the saved text before replacing it.",
              )}
            </p>
            <blockquote>{plan.notes}</blockquote>
            <button
              className="secondary"
              type="button"
              onClick={() => saveNotes(true)}
            >
              {t(
                "แทนที่ด้วยข้อความร่างนี้",
                "Replace saved notes with this draft",
              )}
            </button>
          </div>
        )}
        <p role="status">
          {dirty
            ? t("มีข้อความที่ยังไม่บันทึก", "You have unsaved notes.")
            : status}
        </p>
      </section>
    </article>
  );
}
