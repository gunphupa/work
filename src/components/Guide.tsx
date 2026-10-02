import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  BookOpen,
  Package,
  Play,
  ExternalLink,
  ShieldCheck,
  Plus,
  List,
  Lightbulb,
  ChevronRight,
  Download,
  Trash2,
} from "lucide-react";
import { localizeProject, categories } from "../data/projects";
import { materialById } from "../data/materials";
import { matchProject, type RequirementStatus } from "../domain/matching";
import type { Project, InventoryItem, Progress, Step } from "../domain/schema";
import { useLanguage, unitText } from "../i18n";
import { ProjectArt } from "./Art";
import { AIHelp } from "./Inventory";
import { ProjectCommunity } from "./Community";
import { StepVisual } from "./StepVisual";
import { guideDetails } from "../data/guide-details";
export function ProjectGuide({
  project,
  inventory,
  progress,
  hasBuild,
  start,
  update,
  addMaterial,
  health,
}: {
  project: Project;
  inventory: InventoryItem[];
  progress?: Progress;
  hasBuild: boolean;
  start: () => void;
  update: (p: Progress) => void;
  addMaterial: (id: string) => void;
  health: string;
}) {
  const { t, language } = useLanguage();
  const p = localizeProject(project, language);
  const match = matchProject(p, inventory);
  const cat = categories.find((c) => c.id === p.category)!;
  const [tab, setTab] = useState<"steps" | "materials" | "tutorials">("steps");
  const [active, setActive] = useState(() => {
    const next = progress
      ? p.steps.findIndex((_, i) => !progress.completed.includes(i))
      : 0;
    return Math.max(0, next);
  });
  const [allSteps, setAllSteps] = useState(false);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const [measurement, setMeasurement] = useState({
    name: "",
    value: "",
    unit: p.test.unit,
  });
  const statusText = (s: RequirementStatus) =>
    ({
      satisfied: t("มีครบตามข้อมูล", "Listed as available"),
      short: t("จำนวนยังไม่พอ", "Need a few more"),
      missing: t("ยังไม่บันทึกว่ามี", "Not in your inventory"),
      incompatible: t("ตรวจชนิดหรือสเปก", "Check type or specifications"),
      unknown: t("ตรวจรายละเอียดเพิ่ม", "Details to check"),
    })[s];
  function move(index: number) {
    setActive(index);
    requestAnimationFrame(() => {
      stepRef.current?.focus();
      stepRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
  const toggle = (i: number) => {
    if (progress)
      update({
        ...progress,
        completed: progress.completed.includes(i)
          ? progress.completed.filter((n) => n !== i)
          : [...progress.completed, i],
      });
  };
  return (
    <>
      <a className="back-link" href="#/explore">
        <ArrowLeft size={16} />
        {t("กลับไปเลือกโปรเจกต์", "Back to projects")}
      </a>
      <section className="detail-hero">
        <div className="detail-art">
          <ProjectArt kind={p.icon} />
          <span className="art-label">{t(cat.th, cat.en)}</span>
        </div>
        <div className="detail-copy">
          <div className="eyebrow">
            {t("ทำของใช้ เรียนรู้ไปด้วย", "MAKE SOMETHING. LEARN SOMETHING.")}
          </div>
          <h1>{p.title}</h1>
          <p className="detail-description">{p.description}</p>
          <div className="detail-meta">
            <span>
              <Clock size={16} />
              {t(`ประมาณ ${p.minutes} นาที`, `About ${p.minutes} min`)}
            </span>
            <span>
              <List size={16} />
              {p.steps.length} {t("ขั้นตอน", "steps")}
            </span>
            <span>
              {p.level === 1
                ? t("เริ่มต้น", "Beginner")
                : t("มีพื้นฐาน", "Some experience")}
            </span>
          </div>
          {progress ? (
            <div className="saved-label">
              <CheckCircle2 size={17} />
              {t(
                "กำลังบันทึกงานในเบราว์เซอร์นี้",
                "Saving your build in this browser",
              )}
            </div>
          ) : (
            <button className="secondary" onClick={start}>
              <Plus size={17} />
              {hasBuild
                ? t("เปิดงานที่บันทึกไว้", "Continue saved build")
                : t(
                    "บันทึกไว้ทำและจดความคืบหน้า",
                    "Save a build & track progress",
                  )}
            </button>
          )}
          <p className="open-guide-note">
            <BookOpen size={16} />
            {t(
              "อ่านได้ทุกขั้น แม้ของยังไม่ครบ",
              "Every step is open, even with missing materials.",
            )}
          </p>
        </div>
      </section>
      <section className="guide-overview panel">
        <div>
          <span className="eyebrow">
            {t("รู้จักโปรเจกต์นี้", "ABOUT THIS PROJECT")}
          </span>
          <h2>
            {t("ทำอะไร และทำงานอย่างไร", "What you’ll make and how it works")}
          </h2>
          {guideDetails[p.id] ? (
            guideDetails[p.id][language].map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))
          ) : (
            <>
              <p>
                {p.description}{" "}
                {t(
                  "บทเรียนนี้ใช้ Arduino UNO R3 และแสดงลำดับตั้งแต่เตรียมอุปกรณ์ ต่อวงจร อัปโหลดโค้ด ไปจนถึงสังเกตผลจริง",
                  "This lesson uses an Arduino UNO R3 and walks through preparation, circuit connections, uploading the sketch and observing the result.",
                )}
              </p>
              <p>{p.test.instruction}</p>
              <p>
                {t(
                  "ใช้รายการวัสดุและจุดเชื่อมต่อของโปรเจกต์นี้ ถอด USB ก่อนต่อสาย แล้วตรวจอีกครั้งก่อนอัปโหลด โค้ดดาวน์โหลดได้ในส่วนการต่อวงจรและโค้ด Arduino",
                  "Use this project’s material list and connection map. Disconnect USB while wiring and check connections before uploading. Download the sketch from Wiring & Arduino code below.",
                )}
              </p>
            </>
          )}
        </div>
        <div className="overview-outcome">
          <h3>
            {t("เมื่อทำเสร็จ ลองสิ่งนี้", "When it’s finished, try this")}
          </h3>
          <p>{p.test.instruction}</p>
          <p className="form-hint">
            {t(
              "คู่มือต้นฉบับ ReBuild หรือดัดแปลงจากแหล่งอ้างอิงด้านล่าง ยังไม่ได้ทดสอบชิ้นงานจริง",
              "An original or source-adapted ReBuild guide. Physical build testing has not been performed.",
            )}
          </p>
        </div>
      </section>
      <div
        className="guide-tabs"
        aria-label={t("ส่วนของคู่มือ", "Guide sections")}
      >
        {(
          [
            ["steps", BookOpen, t("วิธีทำทีละขั้น", "Step-by-step")],
            ["materials", Package, t("ของที่ต้องใช้", "Materials")],
            [
              "tutorials",
              Play,
              t("วิดีโอและแหล่งเรียนรู้", "Videos & sources"),
            ],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="guide-layout">
        <section className="guide-main">
          {tab === "steps" && (
            <>
              <div className="guide-intro">
                <div>
                  <h2>
                    {progress
                      ? t("ทำไปทีละขั้น", "One step at a time")
                      : t("เริ่มอ่านวิธีทำ", "Here’s how to make it")}
                  </h2>
                  <p>
                    {progress
                      ? t(
                          "ติ๊กเพื่อจดความคืบหน้าของคุณ ไม่จำเป็นต้องกรอกคลังให้ครบ",
                          "Check off your own progress. A complete inventory is not required.",
                        )
                      : t(
                          "อ่านเพื่อเรียนรู้ก่อนก็ได้ ไม่ต้องกดบันทึกหรือยืนยันของ",
                          "Just here to learn? Read freely without saving or confirming materials.",
                        )}
                  </p>
                </div>
                <button
                  className="text-link"
                  aria-pressed={allSteps}
                  onClick={() => setAllSteps(!allSteps)}
                >
                  <List size={16} />
                  {allSteps
                    ? t("ดูทีละขั้น", "One step at a time")
                    : t("ดูทุกขั้นตอน", "See all steps")}
                </button>
              </div>
              {!allSteps && (
                <>
                  <nav
                    className="step-navigation"
                    aria-label={t("เลือกขั้นตอน", "Choose a step")}
                  >
                    {p.steps.map((s, i) => (
                      <button
                        key={i}
                        className={
                          i === active
                            ? "active"
                            : progress?.completed.includes(i)
                              ? "done"
                              : ""
                        }
                        aria-current={i === active ? "step" : undefined}
                        aria-label={t(
                          `ขั้นตอน ${i + 1}: ${s.title}`,
                          `Step ${i + 1}: ${s.title}`,
                        )}
                        onClick={() => move(i)}
                      >
                        {progress?.completed.includes(i) ? (
                          <Check size={16} />
                        ) : (
                          i + 1
                        )}
                      </button>
                    ))}
                  </nav>
                  <article className="step-card">
                    <div className="step-card-kicker">
                      {t(
                        `ขั้นตอน ${active + 1} จาก ${p.steps.length}`,
                        `STEP ${active + 1} OF ${p.steps.length}`,
                      )}
                    </div>
                    <h3 ref={stepRef} tabIndex={-1}>
                      {p.steps[active].title}
                    </h3>
                    <StepContent
                      step={p.steps[active]}
                      project={p}
                      index={active}
                    />
                    {progress && (
                      <label className="completion-check">
                        <input
                          type="checkbox"
                          checked={progress.completed.includes(active)}
                          onChange={() => toggle(active)}
                        />
                        {t("ฉันทำขั้นตอนนี้แล้ว", "I’ve done this step")}
                      </label>
                    )}
                  </article>
                  <div className="step-controls">
                    <button
                      className="secondary"
                      disabled={active === 0}
                      onClick={() => move(active - 1)}
                    >
                      <ArrowLeft size={17} />
                      {t("ก่อนหน้า", "Previous")}
                    </button>
                    {active < p.steps.length - 1 ? (
                      <button
                        className="primary"
                        onClick={() => move(active + 1)}
                      >
                        {t("ขั้นตอนถัดไป", "Next step")}
                        <ArrowRight size={17} />
                      </button>
                    ) : (
                      <button
                        className="primary"
                        onClick={() => setTab("materials")}
                      >
                        {t("กลับไปเช็กของ", "Review the materials")}
                        <Package size={17} />
                      </button>
                    )}
                  </div>
                </>
              )}
              {allSteps && (
                <ol className="all-guide-steps">
                  {p.steps.map((s, i) => (
                    <li key={i} className="step-card">
                      <div className="step-card-kicker">
                        {t(`ขั้นตอน ${i + 1}`, `STEP ${i + 1}`)}
                      </div>
                      <h3>{s.title}</h3>
                      <StepContent step={s} project={p} index={i} />
                      {progress && (
                        <label className="completion-check">
                          <input
                            type="checkbox"
                            checked={progress.completed.includes(i)}
                            onChange={() => toggle(i)}
                          />
                          {t("ฉันทำขั้นตอนนี้แล้ว", "I’ve done this step")}
                        </label>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {p.code && (
                <details className="panel code-panel">
                  <summary>
                    {t("การต่อวงจรและโค้ด Arduino", "Wiring & Arduino code")}
                  </summary>
                  <p>
                    {t(
                      "ถอด USB ก่อนต่อสาย ตรวจรุ่น UNO R3 และขาอุปกรณ์กับข้อมูลผู้ผลิต",
                      "Disconnect USB before wiring. Check the UNO R3 model and manufacturer pinouts.",
                    )}
                  </p>
                  {p.wiring?.length ? (
                    <div className="wiring">
                      {p.wiring.map((w, i) => (
                        <div key={i}>
                          <span>{w.from}</span>
                          <ArrowRight size={16} />
                          <span>{w.to}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>
                      {t(
                        "ตัวอย่างนี้ใช้ USB และอุปกรณ์บนบอร์ด ไม่ต้องต่อวงจรภายนอก",
                        "This example uses USB and onboard hardware; no external circuit is required.",
                      )}
                    </p>
                  )}
                  <p>
                    {t(
                      "ผังเป็นจุดเชื่อมต่อ ดูภาพวงจรจริงจากคู่มือต้นทาง ไม่ใช่ตำแหน่งรูเบรดบอร์ด",
                      "These are connection points, not breadboard hole positions. See the reference guide’s circuit illustration.",
                    )}
                  </p>
                  <pre>
                    <code>{p.code}</code>
                  </pre>
                  <button
                    className="secondary"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([p.code!], { type: "text/plain" }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `rebuild-${p.id}.ino`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    <Download size={16} />
                    {t("ดาวน์โหลดสเก็ตช์ .ino", "Download .ino sketch")}
                  </button>
                  <p className="form-hint">
                    {t(
                      "สเก็ตช์ต้นฉบับ ReBuild ยังไม่ได้คอมไพล์ด้วย AVR หรือทดสอบกับบอร์ดจริง",
                      "Original ReBuild sketch. Not AVR-compiled or physically tested.",
                    )}
                  </p>
                </details>
              )}
              <section className="panel final-check">
                <h2>
                  {t(
                    "ทดสอบผลงานและสรุปสิ่งที่เรียนรู้",
                    "Test your build & reflect",
                  )}
                </h2>
                <p>{p.test.instruction}</p>
                <ul>
                  <li>{p.steps[p.steps.length - 1].check}</li>
                  <li>
                    {t(
                      "ถ้าผลไม่ตรงที่คาด ให้ย้อนดูจุดตรวจแต่ละขั้น เปลี่ยนทีละอย่างแล้วลองใหม่",
                      "If the result is unexpected, revisit each step’s check. Change one thing at a time and try again.",
                    )}
                  </li>
                  <li>
                    {t(
                      "จดสิ่งที่ใช้ได้ สิ่งที่ต้องปรับ และวัสดุทดแทนที่ได้ลอง จากนั้นแบ่งปันในส่วนชุมชนด้านล่างได้",
                      "Note what worked, what needs changing and any substitutions you tried. Share your experience in the community section below.",
                    )}
                  </li>
                </ul>
              </section>
              {progress && (
                <>
                  <div className="panel notes-panel">
                    <h2>
                      {t(
                        "จดสิ่งที่ได้เรียนรู้",
                        "Keep a little learning journal",
                      )}
                    </h2>
                    <label>
                      {t(
                        "ปัญหา สิ่งที่ลอง และไอเดียต่อยอด",
                        "Notes, things you tried, and new ideas",
                      )}
                      <textarea
                        rows={4}
                        maxLength={10000}
                        value={progress.notes}
                        onChange={(e) =>
                          update({ ...progress, notes: e.target.value })
                        }
                        placeholder={t(
                          "อะไรใช้ได้ อะไรอยากปรับ…",
                          "What worked? What would you change?",
                        )}
                      />
                    </label>
                    <p className="form-hint">
                      {t(
                        "บันทึกอัตโนมัติในเบราว์เซอร์นี้",
                        "Saved automatically in this browser.",
                      )}
                    </p>
                  </div>
                  <details className="panel">
                    <summary>
                      {t(
                        "บันทึกผลทดลองและชิ้นส่วนทดแทน",
                        "Measurements & substitutions",
                      )}
                    </summary>
                    <p>{p.test.instruction}</p>
                    <form
                      className="stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        update({
                          ...progress,
                          measurements: [
                            ...progress.measurements,
                            measurement,
                          ].slice(0, 50),
                        });
                        setMeasurement({ ...measurement, name: "", value: "" });
                      }}
                    >
                      <div className="form-columns">
                        <label>
                          {t("สิ่งที่วัด", "Measurement")}
                          <input
                            required
                            maxLength={100}
                            value={measurement.name}
                            onChange={(e) =>
                              setMeasurement({
                                ...measurement,
                                name: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          {t("ค่าที่ได้", "Value")}
                          <input
                            required
                            maxLength={100}
                            value={measurement.value}
                            onChange={(e) =>
                              setMeasurement({
                                ...measurement,
                                value: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          {t("หน่วย", "Unit")}
                          <input
                            required
                            maxLength={40}
                            value={measurement.unit}
                            onChange={(e) =>
                              setMeasurement({
                                ...measurement,
                                unit: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="secondary"
                        disabled={progress.measurements.length >= 50}
                      >
                        <Plus size={16} />
                        {t("เพิ่มผลการวัด", "Add measurement")}
                      </button>
                    </form>
                    {progress.measurements.map((m, i) => (
                      <div className="measurement" key={i}>
                        <span>{m.name}</span>
                        <strong>
                          {m.value} {m.unit}
                        </strong>
                        <button
                          className="icon-button"
                          aria-label={`${t("ลบผล", "Delete measurement")} ${m.name}`}
                          onClick={() => {
                            if (
                              confirm(
                                t("ลบผลการวัดนี้?", "Delete this measurement?"),
                              )
                            )
                              update({
                                ...progress,
                                measurements: progress.measurements.filter(
                                  (_, n) => n !== i,
                                ),
                              });
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <p className="form-hint">
                      {t(
                        "กรอกสิ่งที่วัดเอง การติ๊กขั้นตอนไม่ใช่ผลทดสอบทางกายภาพ",
                        "Record your own observations. Checked steps are not physical test evidence.",
                      )}
                    </p>
                    <h3>
                      {t(
                        "ใช้วัสดุอื่นแทนอะไรบ้าง?",
                        "Did you use an alternative?",
                      )}
                    </h3>
                    <p>
                      {t(
                        "บันทึกนี้ไม่เปลี่ยนข้อกำหนด แก้ข้อมูลในคลังเพื่อเช็กชนิดและสเปก",
                        "This note does not change the requirements. Update inventory to check types and specifications.",
                      )}
                    </p>
                    {p.requirements.map((r) => (
                      <label className="substitute-label" key={r.id}>
                        {r.label}
                        <input
                          maxLength={500}
                          value={progress.substitutions[r.id] ?? ""}
                          onChange={(e) =>
                            update({
                              ...progress,
                              substitutions: {
                                ...progress.substitutions,
                                [r.id]: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </details>
                </>
              )}
            </>
          )}
          {tab === "materials" && (
            <>
              <div className="guide-intro">
                <div>
                  <h2>{t("ของที่ต้องเตรียม", "What you’ll need")}</h2>
                  <p>
                    {inventory.length
                      ? t(
                          `ข้อมูลในคลังตรง ${match.fulfilled} จาก ${match.requirements.length} รายการ อ่านและจดความคืบหน้าได้ทุกขั้น`,
                          `${match.fulfilled} of ${match.requirements.length} requirements match your inventory. Every step and progress check stays open.`,
                        )
                      : t(
                          "นี่คือรายการสำหรับลงมือทำจริง ไม่ต้องกรอกของก่อนอ่านคู่มือ",
                          "Use this list when you decide to build. You don’t have to enter materials to read the guide.",
                        )}
                  </p>
                </div>
              </div>
              <div className="requirements">
                {(
                  [
                    [
                      "material",
                      t(
                        "วัสดุและของที่จะนำมาใช้",
                        "Materials & items to reuse",
                      ),
                    ],
                    [
                      "component",
                      t("ชิ้นส่วนอิเล็กทรอนิกส์", "Electronic components"),
                    ],
                    ["tool", t("เครื่องมือ", "Tools")],
                  ] as const
                ).map(([kind, label]) => {
                  const rows = match.requirements.filter(
                    (r) =>
                      materialById[r.requirement.choices[0].materialId].kind ===
                      kind,
                  );
                  return (
                    rows.length > 0 && (
                      <section className="supply-group" key={kind}>
                        <h3>{label}</h3>
                        {rows.map((r) => (
                          <article
                            className={`requirement ${r.status === "satisfied" ? "satisfied" : ""}`}
                            key={r.requirement.id}
                          >
                            <span className="requirement-symbol">
                              {r.status === "satisfied" ? (
                                <CheckCircle2 size={21} />
                              ) : (
                                <Package size={21} />
                              )}
                            </span>
                            <div className="requirement-body">
                              <div className="requirement-title">
                                <h3>{r.requirement.label}</h3>
                                <span className="quantity-badge">
                                  {r.requirement.quantity}{" "}
                                  {unitText(
                                    materialById[
                                      r.requirement.choices[0].materialId
                                    ].unit,
                                    language,
                                  )}
                                </span>
                              </div>
                              <p>{r.requirement.why}</p>
                              {r.requirement.choices.some(
                                (c) => Object.keys(c.specs ?? {}).length > 0,
                              ) && (
                                <p className="spec-line">
                                  {r.requirement.choices
                                    .map((c) =>
                                      Object.values(c.specs ?? {})
                                        .map((v) => v.join(t(" หรือ ", " or ")))
                                        .join(" · "),
                                    )
                                    .join(" / ")}
                                </p>
                              )}
                              {inventory.length > 0 && (
                                <small className="inventory-match">
                                  {statusText(r.status)} · {r.available}/
                                  {r.requirement.quantity}
                                </small>
                              )}
                              {r.requirement.choices.length > 1 && (
                                <div className="alternative-note">
                                  <Lightbulb size={16} />
                                  {t(
                                    "ใช้แทนกันได้ในคู่มือนี้: ",
                                    "Alternatives in this guide: ",
                                  )}
                                  {r.requirement.choices
                                    .map((c) =>
                                      t(
                                        materialById[c.materialId].name,
                                        materialById[c.materialId].en,
                                      ),
                                    )
                                    .join(t(" หรือ ", " or "))}
                                </div>
                              )}
                              <details className="item-options">
                                <summary>
                                  {t(
                                    "บันทึกว่ามี / หาของชิ้นนี้",
                                    "Record an item / find this material",
                                  )}
                                </summary>
                                <div className="button-row">
                                  {r.requirement.choices.map((c) => (
                                    <button
                                      className="secondary"
                                      key={c.materialId}
                                      onClick={() => addMaterial(c.materialId)}
                                    >
                                      <Plus size={15} />
                                      {t(
                                        materialById[c.materialId].name,
                                        materialById[c.materialId].en,
                                      )}
                                    </button>
                                  ))}
                                </div>
                                <p className="form-hint">
                                  {t(
                                    "ลองหาของสะอาดที่บ้านหรือยืมก่อน ลิงก์ด้านล่างเป็นผลค้นหา ไม่ใช่สินค้าที่ตรวจแล้ว",
                                    "Look for clean items at home or borrow first. The links below are searches, not reviewed products.",
                                  )}
                                </p>
                                <div className="button-row">
                                  <a
                                    className="text-link"
                                    href={`https://shopee.co.th/search?keyword=${encodeURIComponent(r.requirement.label)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Shopee
                                    <ExternalLink size={14} />
                                  </a>
                                  <a
                                    className="text-link"
                                    href={`https://www.lazada.co.th/catalog/?q=${encodeURIComponent(r.requirement.label)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Lazada
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              </details>
                            </div>
                          </article>
                        ))}
                      </section>
                    )
                  );
                })}
              </div>
              <button className="primary" onClick={() => setTab("steps")}>
                {t("อ่านขั้นตอนต่อ", "Read the steps")}
                <ArrowRight size={17} />
              </button>
            </>
          )}
          {tab === "tutorials" && (
            <>
              <div className="guide-intro">
                <div>
                  <h2>{t("ดูวิธีทำเพิ่มเติม", "See how it’s done")}</h2>
                  <p>
                    {t(
                      "ใช้คู่มือเป็นหลัก แล้วเปิดแหล่งเรียนรู้เพิ่มในแท็บใหม่",
                      "Keep this guide handy and open extra learning resources in a new tab.",
                    )}
                  </p>
                </div>
              </div>
              {p.video && (
                <article className="video-card">
                  <div className="video-symbol">
                    <Play size={35} />
                  </div>
                  <div>
                    <span className="eyebrow">{p.video.publisher}</span>
                    <h3>{p.video.title}</h3>
                    <p>
                      {t(
                        "ลิงก์วิดีโอจากหน้าคู่มือ NASA ทางการ ยังไม่ได้ตรวจเนื้อหาวิดีโอครบ",
                        "Video linked by NASA’s official written guide. The full video has not been reviewed here.",
                      )}
                    </p>
                    <a
                      className="primary"
                      href={p.video.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("เปิดวิดีโอ NASA", "Watch the NASA tutorial")}
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </article>
              )}
              <article className="panel video-search">
                <Play size={24} />
                <h3>
                  {t("หาคลิปสอนทำบน YouTube", "Find a tutorial on YouTube")}
                </h3>
                <p>
                  {t(
                    "เปิดผลค้นหาตามโปรเจกต์นี้ ไม่ใช่คลิปที่เราตรวจแล้ว เลือกคลิปที่ใช้วัสดุและวิธีใกล้เคียงกับคู่มือ",
                    "These links open project-specific search results, not reviewed videos. Choose a tutorial with matching materials and methods.",
                  )}
                </p>
                <div className="button-row">
                  <a
                    className="secondary"
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(p.videoQuery?.[language] ?? `${p.title} ${p.source.title} tutorial`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <SearchVideo />
                    {t("ค้นหาคลิปภาษาไทย", "Search English tutorials")}
                    <ExternalLink size={15} />
                  </a>
                  <a
                    className="text-link"
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(project.videoQuery?.[language === "th" ? "en" : "th"] ?? `${localizeProject(project, language === "th" ? "en" : "th").title} tutorial`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("ค้นหาคลิปภาษาอังกฤษ", "Search Thai tutorials")}
                    <ExternalLink size={15} />
                  </a>
                </div>
              </article>
              <SourceCard project={p} />
            </>
          )}
        </section>
        <aside className="guide-aside">
          {progress && (
            <div className="panel">
              <h3>{t("ความคืบหน้าของคุณ", "Your progress")}</h3>
              <strong className="progress-count">
                {progress.completed.length}
                <span> / {p.steps.length}</span>
              </strong>
              <div
                className="progress-track"
                role="progressbar"
                aria-label={t("ขั้นตอนที่ทำแล้ว", "Completed steps")}
                aria-valuenow={progress.completed.length}
                aria-valuemin={0}
                aria-valuemax={p.steps.length}
              >
                <span
                  style={{
                    width: `${(progress.completed.length / p.steps.length) * 100}%`,
                  }}
                />
              </div>
              <p>
                {t(
                  "บันทึกของไม่จองไว้แยกแต่ละงาน ตรวจจำนวนจริงก่อนใช้พร้อมกัน",
                  "Inventory is not reserved per build. Check actual quantities before using it in multiple projects.",
                )}
              </p>
            </div>
          )}
          <div className="panel green-panel">
            <span className="eyebrow">
              {t("เรียนรู้จากการลงมือ", "THE LITTLE LESSON")}
            </span>
            <h3>
              <Lightbulb size={19} />
              {t("จะได้เรียนรู้อะไร", "What you’ll learn")}
            </h3>
            <ul className="learning-list">
              {p.learning.map((l) => (
                <li key={l}>
                  <Check size={16} />
                  {l}
                </li>
              ))}
            </ul>
            <p className="experiment-prompt">{p.test.instruction}</p>
          </div>
          <div className="panel before-build">
            <h3>
              <ShieldCheck size={18} />
              {t("ก่อนลงมือจริง", "Before you build")}
            </h3>
            <p>{p.limitations}</p>
            <p className="form-hint">
              {t(
                "ภาพเป็นแนวคิด อ่านขนาดและขั้นตอนเป็นหลัก",
                "Illustrations show the idea. Follow the written dimensions and steps.",
              )}
            </p>
          </div>
          <button
            className="aside-link"
            onClick={() => setTab(tab === "materials" ? "steps" : "materials")}
          >
            <Package size={20} />
            {tab === "materials"
              ? t("กลับไปอ่านวิธีทำ", "Back to the steps")
              : t("ดูของที่ต้องใช้", "See the material list")}
            <ChevronRight size={17} />
          </button>
          <AIHelp
            projectId={p.id}
            step={active}
            inventory={inventory}
            health={health}
          />
        </aside>
      </div>
      <ProjectCommunity key={p.id} target={p.id} />
    </>
  );
}
function StepContent({
  step,
  project,
  index,
}: {
  step: Step;
  project: Project;
  index: number;
}) {
  const { t } = useLanguage();
  return (
    <>
      <StepVisual project={project} index={index} />
      <div className="step-actions">
        <h4>{t("ลงมือทำ", "What to do")}</h4>
        {/[.!?]\s+(?=[A-Z])/.test(step.text) ? (
          <ol>
            {step.text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ol>
        ) : (
          <p className="step-instruction">{step.text}</p>
        )}
      </div>
      {step.safety && (
        <div className="safety-note">
          <ShieldCheck size={18} />
          <p>{step.safety}</p>
        </div>
      )}
      <div className="checkpoint">
        <CheckCircle2 size={20} />
        <div>
          <strong>{t("เช็กง่าย ๆ ก่อนขั้นถัดไป", "A quick check")}</strong>
          <p>{step.check}</p>
        </div>
      </div>
    </>
  );
}
function SearchVideo() {
  return <Play size={15} />;
}
function SourceCard({ project: p }: { project: Project }) {
  const { t } = useLanguage();
  return (
    <article className="source-card">
      <BookOpen size={25} />
      <div>
        <div className="eyebrow">
          {p.original
            ? t("คู่มือต้นฉบับของเรา", "AN ORIGINAL REBUILD GUIDE")
            : t("เอกสารอ้างอิง", "REFERENCE GUIDE")}
        </div>
        <h3>{p.source.title}</h3>
        <p>
          {p.source.author} · {p.source.language}
        </p>
        <p>{p.source.inspection}</p>
        <small>
          {t("วันที่บันทึกเนื้อหา", "Content recorded")}: {p.source.checkedAt}
        </small>
        <a
          className="text-link"
          href={p.source.url}
          target="_blank"
          rel="noreferrer"
        >
          {p.original
            ? t("ดูข้อมูลคู่มือใน GitHub", "View the guide data on GitHub")
            : t(
                "เปิดคู่มือต้นทางและภาพขั้นตอน",
                "Open the reference guide & illustrations",
              )}
          <ExternalLink size={15} />
        </a>
      </div>
    </article>
  );
}
