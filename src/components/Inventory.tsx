import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  Check,
  Search,
  Camera,
  Sparkles,
  X,
  LoaderCircle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Modal } from "./Modal";
import { useLanguage, unitText, type Language } from "../i18n";
import { materialById } from "../data/materials";
import { searchMaterials } from "../domain/catalogue";
import { parseInventory } from "../domain/inventory";
import { itemSchema, type InventoryItem } from "../domain/schema";
import { preparePhotos } from "../domain/images";
import type { AIAnswer, AIRequest } from "../../server/ai";
export type EditorSeed = {
  item?: InventoryItem;
  materialId?: string;
  label?: string;
};
const specLabels: Record<string, string> = {
  model: "Model printed on the board",
  connector: "Board-end connector",
  data: "Supports data transfer",
  ide: "Arduino IDE and AVR Boards installed",
  type: "Type",
  ohms: "Resistance (Ω)",
  template: "Paper template",
  metric: "Has cm or m markings",
  voltage: "Rated voltage (V)",
  cap: "Has a matching cap",
  capacity: "Bottle capacity",
  opening: "Mesh opening size",
};
export function ItemEditor({
  seed,
  close,
  save,
}: {
  seed: EditorSeed;
  close: () => void;
  save: (i: InventoryItem) => void;
}) {
  const { t, language } = useLanguage();
  const material =
    materialById[seed.item?.materialId ?? seed.materialId ?? "unknown"] ??
    materialById.unknown;
  const [picking, setPicking] = useState(!seed.item && !seed.materialId),
    [query, setQuery] = useState(""),
    [showAll, setShowAll] = useState(false),
    [error, setError] = useState("");
  const [draft, setDraft] = useState<InventoryItem>(
    seed.item ?? {
      id: crypto.randomUUID(),
      materialId: material.id,
      label: seed.label ?? t(material.name, material.en),
      quantity: 1,
      unit: material.unit,
      condition: "usable",
      verified: false,
      specs: {},
      notes: "",
    },
  );
  const mat = materialById[draft.materialId] ?? materialById.unknown;
  const results = searchMaterials(query).sort(
    (a, b) => Number(a.kind === "component") - Number(b.kind === "component"),
  );
  function choose(id: string) {
    const m = materialById[id];
    setDraft({
      ...draft,
      materialId: id,
      label: id === "unknown" && query.trim() ? query.trim() : t(m.name, m.en),
      unit: m.unit,
      specs: {},
      verified: false,
    });
    setPicking(false);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = itemSchema.safeParse({ ...draft, verified: true });
    if (!parsed.success) {
      setError(
        t(
          "ตรวจชื่อและจำนวน จำนวนต้องเป็นจำนวนเต็มระหว่าง 1–10,000",
          "Enter a name and a whole-number quantity from 1 to 10,000.",
        ),
      );
      return;
    }
    save(parsed.data);
  }
  return (
    <Modal
      title={
        seed.item
          ? t("แก้ไขรายละเอียดของ", "Edit item details")
          : t("เพิ่มของที่มี", "Add an item")
      }
      close={close}
    >
      {picking ? (
        <div className="stack">
          <p>
            {t(
              "ค้นหาสิ่งที่คุณมี หรือเลือกจากของในบ้านด้านล่าง",
              "Search for what you have or choose a household item below.",
            )}
          </p>
          <label className="search-field">
            <Search size={18} />
            <input
              autoFocus
              aria-label={t("ค้นหาประเภทสิ่งของ", "Search material types")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowAll(false);
              }}
              placeholder={t(
                "เช่น กล่อง ขวด เสื้อยืด…",
                "Try cardboard, bottle, T-shirt…",
              )}
            />
          </label>
          <div className="material-picker">
            {results.slice(0, showAll ? results.length : 18).map((m) => (
              <button key={m.id} type="button" onClick={() => choose(m.id)}>
                <strong>{t(m.name, m.en)}</strong>
                <small>{t(m.en, m.name)}</small>
              </button>
            ))}
          </div>
          {results.length > 18 && !showAll && (
            <button className="text-link" onClick={() => setShowAll(true)}>
              {t(
                `แสดงทั้งหมด ${results.length} ชนิด`,
                `Show all ${results.length} types`,
              )}
            </button>
          )}
          <button className="secondary" onClick={() => choose("unknown")}>
            <Plus size={17} />
            {t(
              "ไม่พบ? เพิ่มของอื่นด้วยชื่อของคุณเอง",
              "Not listed? Add a custom item",
            )}
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="chosen-material">
            <div>
              <small>{t("ประเภทสิ่งของ", "Material type")}</small>
              <strong>{t(mat.name, mat.en)}</strong>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => setPicking(true)}
            >
              {t("เปลี่ยน", "Change")}
            </button>
          </div>
          <label>
            {t("ชื่อที่คุณเรียก", "Your name for this item")}
            <input
              autoFocus
              required
              maxLength={160}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          <div className="form-columns">
            <label>
              {t("จำนวน", "Quantity")}
              <div className="quantity-input">
                <input
                  aria-label={t("จำนวน", "Quantity")}
                  required
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={draft.quantity || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, quantity: Number(e.target.value) })
                  }
                />
                <span>{unitText(mat.unit, language)}</span>
              </div>
            </label>
            <label>
              {t("สภาพ", "Condition")}
              <select
                value={draft.condition}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    condition: e.target.value as InventoryItem["condition"],
                  })
                }
              >
                <option value="usable">
                  {t("ตรวจแล้ว ใช้งานได้", "Checked and usable")}
                </option>
                <option value="unknown">
                  {t("ยังไม่แน่ใจ", "Not sure yet")}
                </option>
                <option value="damaged">{t("ชำรุด", "Damaged")}</option>
              </select>
            </label>
          </div>
          {(language === "th" ? mat.hint : mat.hintEn) && (
            <p className="form-hint">
              {language === "th" ? mat.hint : mat.hintEn}
            </p>
          )}
          {Object.keys(mat.specs).length > 0 && (
            <div className="spec-fields">
              <h3>
                {t("รายละเอียดที่คู่มืออาจต้องใช้", "Details a guide may need")}
              </h3>
              <p>
                {t(
                  "ไม่รู้ค่าไหน เลือก “ยังไม่แน่ใจ” ได้ ไม่ขัดขวางการอ่านคู่มือ",
                  "Choose “Not sure” for anything unknown. This never blocks a guide.",
                )}
              </p>
              {Object.entries(mat.specs).map(([key, spec]) => (
                <label key={key}>
                  {t(spec.label, specLabels[key] ?? key)}
                  <select
                    value={draft.specs[key] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        specs: { ...draft.specs, [key]: e.target.value },
                      })
                    }
                  >
                    <option value="">{t("ยังไม่แน่ใจ", "Not sure")}</option>
                    {spec.options.map((o) => (
                      <option key={o} value={o}>
                        {o === "yes"
                          ? t("ใช่", "Yes")
                          : o === "no"
                            ? t("ไม่ใช่", "No")
                            : o === "other"
                              ? t("รุ่นอื่น", "Other")
                              : o === "plain"
                                ? t("กระดาษเปล่า", "Plain paper")
                                : o}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <label>
            {t(
              "หมายเหตุหรือขนาด (ไม่บังคับ)",
              "Notes or dimensions (optional)",
            )}
            <input
              maxLength={1000}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          <p className="form-hint">
            {t(
              "การบันทึกใช้รายละเอียดที่คุณกรอกเช็กรายการวัสดุ ค่าไหนไม่แน่ใจให้เว้นไว้ ยังอ่านและบันทึกขั้นตอนได้ทุกโปรเจกต์",
              "Saving uses your entered details for material checks. Leave uncertain specifications unknown. Every guide and progress checklist stays available.",
            )}
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={close}>
              {t("ยกเลิก", "Cancel")}
            </button>
            <button className="primary" type="submit">
              {t("บันทึกรายการ", "Save item")}
              <Check size={17} />
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
export async function askAI(
  input: Partial<AIRequest>,
  signal: AbortSignal,
  language: Language,
): Promise<AIAnswer> {
  const session = await fetch("/api/session", { signal });
  if (!session.ok)
    throw Error(
      language === "th"
        ? "เริ่มเซสชันไม่ได้ โปรดลองอีกครั้ง"
        : "Could not start a session. Please try again.",
    );
  const { csrf } = await session.json();
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify({ ...input, language }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    if (language === "th") throw Error(data.error || "บริการขัดข้อง");
    const errors: Record<number, string> = {
      400: "Check your input and image format, then try again.",
      403: "The security check failed. Refresh the page and try again.",
      413: "The request is too large. Try fewer or smaller photos.",
      429: "The app’s usage limit has been reached. Try again later.",
      502: "The AI service could not complete the request. Your input is still here.",
      503: "AI is unavailable. You can add materials manually and read every guide.",
    };
    throw Error(
      errors[response.status] ??
        "The request failed. Your input is still here; please try again.",
    );
  }
  return data;
}
export function AddModal({
  mode,
  health,
  inventory,
  close,
  add,
}: {
  mode: "bulk" | "photo";
  health: string;
  inventory: InventoryItem[];
  close: () => void;
  add: (items: InventoryItem[]) => void;
}) {
  const { t, language } = useLanguage();
  const [text, setText] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [answer, setAnswer] = useState<AIAnswer | null>(null),
    [parsed, setParsed] = useState<InventoryItem[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(ai: boolean) {
    setError("");
    setBusy(true);
    controller.current = new AbortController();
    try {
      if (ai) {
        const images =
          mode === "photo" ? await preparePhotos(files, language) : [];
        const result = await askAI(
          {
            mode: mode === "photo" ? "photo" : "inventory",
            text,
            images,
            imageConsent: consent,
            inventory,
          },
          controller.current.signal,
          language,
        );
        setAnswer(result);
        setParsed(
          result.candidates.map((c) => ({
            id: crypto.randomUUID(),
            materialId: materialById[c.materialId] ? c.materialId : "unknown",
            label: c.label,
            quantity: c.quantity,
            unit: materialById[c.materialId]?.unit ?? "ชิ้น",
            condition: "unknown",
            verified: false,
            specs: Object.fromEntries(c.specs.map((s) => [s.key, s.value])),
            notes: [c.evidence, ...c.questions].join(" ").slice(0, 1000),
          })),
        );
      } else {
        setParsed(parseInventory(text));
        setAnswer(null);
      }
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? t(
              "ยกเลิกแล้ว ข้อมูลที่กรอกยังอยู่",
              "Cancelled. Your input is still here.",
            )
          : e instanceof Error
            ? e.message
            : t("อ่านข้อมูลไม่ได้", "Could not read the input."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "photo"
          ? t("เพิ่มของจากรูปภาพ", "Add materials from a photo")
          : t("เพิ่มหลายรายการ", "Add a list of materials")
      }
      close={close}
    >
      <div className="stack">
        {mode === "bulk" ? (
          <label>
            {t(
              "รายการของที่มี (หนึ่งรายการต่อบรรทัด)",
              "Your materials (one item per line)",
            )}
            <textarea
              rows={5}
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              placeholder={t(
                "ขวดพลาสติก จำนวน 2\nเสื้อยืด จำนวน 1\nกรรไกร จำนวน 1",
                "Plastic bottle qty 2\nT-shirt qty 1\nScissors qty 1",
              )}
            />
          </label>
        ) : (
          <>
            <p>
              {t(
                "เลือกเฉพาะรูปสิ่งของ หลีกเลี่ยงใบหน้าและข้อมูลส่วนตัว รูปจะส่งให้ OpenAI เมื่อคุณกดวิเคราะห์ แอปไม่เก็บรูปบนเซิร์ฟเวอร์",
                "Choose photos of materials without faces or personal details. Photos go to OpenAI when you analyse them. The app does not store them on its server.",
              )}
            </p>
            <label className="upload-zone">
              <Camera size={34} />
              <strong>{t("เลือกรูปสิ่งของ", "Choose material photos")}</strong>
              <span>
                {t(
                  "JPEG, PNG หรือ WebP · สูงสุด 5 รูป · รูปละ 10 MB",
                  "JPEG, PNG or WebP · Up to 5 photos · 10 MB each",
                )}
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  setFiles(Array.from(e.target.files ?? []));
                  setParsed([]);
                  setAnswer(null);
                }}
              />
            </label>
            <label>
              {t(
                "ข้อมูลเพิ่ม เช่น ชื่อบนฉลาก",
                "Extra details, such as a label",
              )}
              <textarea
                rows={2}
                maxLength={4000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {t(
                "ยินยอมส่งรูปและข้อมูลให้ AI ตามคำอธิบายความเป็นส่วนตัว",
                "I consent to sending photos and details to AI as described in the privacy information.",
              )}
            </label>
          </>
        )}
        {health !== "online" && (
          <div className="notice">
            {t(
              "AI ยังไม่พร้อมใช้งาน เพิ่มรายการด้วยตนเองได้ และอ่านคู่มือได้ทุกขั้น",
              "AI is unavailable. You can add materials manually and read every step.",
            )}
          </div>
        )}
        <div className="button-row">
          {mode === "bulk" && (
            <button
              className="primary"
              disabled={busy || !text.trim()}
              onClick={() => void run(false)}
            >
              {t("แยกรายการจากข้อความ", "Preview my list")}
              <ArrowRight size={16} />
            </button>
          )}
          <button
            className="secondary"
            disabled={
              busy ||
              health !== "online" ||
              (mode === "photo" ? !files.length || !consent : !text.trim())
            }
            onClick={() => void run(true)}
          >
            <Sparkles size={17} />
            {mode === "photo"
              ? t("วิเคราะห์ภาพ", "Analyse photos")
              : t("ให้ AI ช่วยอ่าน", "Ask AI to read it")}
          </button>
          {busy && (
            <button
              className="secondary"
              onClick={() => controller.current?.abort()}
            >
              {t("ยกเลิก", "Cancel")}
            </button>
          )}
        </div>
        {busy && (
          <p role="status">
            <LoaderCircle size={18} className="spinner" />
            {t("กำลังอ่านข้อมูล…", "Reading your input…")}
          </p>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {answer && <div className="ai-answer">{answer.reply}</div>}
        {!!parsed.length && (
          <>
            <h3>{t("ตรวจรายการที่พบ", "Review the suggested items")}</h3>
            <p>
              {t(
                "แก้ชื่อหรือจำนวนได้ที่นี่ รูปหลายมุมอาจเป็นของชิ้นเดียวกัน ลบรายการซ้ำก่อนเพิ่ม ส่วนสภาพและสเปกค่อยตรวจในคลัง",
                "Edit names and quantities here. Different photos may show the same object; remove duplicates. Review condition and specifications in your inventory later.",
              )}
            </p>
            {parsed.map((item, i) => (
              <div className="candidate" key={item.id}>
                <div>
                  <label>
                    {t("ชื่อรายการ", "Item name")}
                    <input
                      maxLength={160}
                      value={item.label}
                      onChange={(e) =>
                        setParsed((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? { ...x, label: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <span>
                    {t(
                      materialById[item.materialId].name,
                      materialById[item.materialId].en,
                    )}
                  </span>
                  <label>
                    {t("จำนวน", "Quantity")}
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      value={item.quantity || ""}
                      onChange={(e) =>
                        setParsed((items) =>
                          items.map((x) =>
                            x.id === item.id
                              ? { ...x, quantity: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  {answer?.candidates[i] && (
                    <small>
                      {answer.candidates[i].evidence}{" "}
                      {answer.candidates[i].questions.join(" ")}
                    </small>
                  )}
                </div>
                <button
                  className="icon-button"
                  aria-label={`${t("ไม่เพิ่ม", "Remove suggestion")} ${item.label}`}
                  onClick={() => {
                    setParsed((items) => items.filter((x) => x.id !== item.id));
                    if (answer)
                      setAnswer({
                        ...answer,
                        candidates: answer.candidates.filter(
                          (_, index) => index !== i,
                        ),
                      });
                  }}
                >
                  <X size={17} />
                </button>
              </div>
            ))}
            <button
              className="primary"
              disabled={parsed.some((i) => !itemSchema.safeParse(i).success)}
              onClick={() => add(parsed)}
            >
              {t(
                `เพิ่ม ${parsed.length} รายการ`,
                `Add ${parsed.length} item${parsed.length === 1 ? "" : "s"}`,
              )}
              <Check size={17} />
            </button>
            <p className="form-hint">
              {t(
                "ข้อเสนอเหล่านี้ยังไม่ถือว่าเป็นของที่ตรวจแล้ว แต่ไม่จำกัดการอ่านคู่มือ",
                "These suggestions remain unchecked. They never restrict access to guides.",
              )}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
export function AIHelp({
  projectId,
  step,
  inventory,
  health,
}: {
  projectId: string;
  step: number;
  inventory: InventoryItem[];
  health: string;
}) {
  const { t, language } = useLanguage();
  const [text, setText] = useState(""),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const result = await askAI(
        { mode: "help", projectId, step, inventory, text },
        controller.current.signal,
        language,
      );
      setAnswer(result.reply);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? t("ยกเลิกแล้ว", "Cancelled.")
          : e instanceof Error
            ? e.message
            : t("บริการไม่พร้อม", "Service unavailable."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel ai-panel">
      <summary>
        <Sparkles size={18} />
        {t("ถามผู้ช่วยเกี่ยวกับขั้นตอนนี้", "Ask about this step")}
      </summary>
      {health !== "online" ? (
        <p>
          {t(
            "AI ยังไม่พร้อม ใช้จุดตรวจสอบในขั้นตอนและคู่มือต้นทางได้ระหว่างนี้",
            "AI is unavailable. Use the step checkpoints and reference guide for now.",
          )}
        </p>
      ) : (
        <form className="stack" onSubmit={(e) => void send(e)}>
          <label>
            {t("อยากให้ช่วยอธิบายตรงไหน?", "What would you like explained?")}
            <textarea
              rows={3}
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <p className="form-hint">
            {t(
              "ส่งคำถาม คลัง และบริบทขั้นตอนให้ OpenAI คำตอบต้องตรวจเองและไม่อนุมัติการแทนชิ้นส่วน",
              "Sends your question, inventory and step context to OpenAI. Review the answer; it does not approve substitutions.",
            )}
          </p>
          <button className="primary" disabled={busy || !text.trim()}>
            {busy ? (
              <LoaderCircle size={16} className="spinner" />
            ) : (
              <Sparkles size={16} />
            )}{" "}
            {t("ถามผู้ช่วย", "Ask the helper")}
          </button>
          {busy && (
            <button
              type="button"
              className="text-link"
              onClick={() => controller.current?.abort()}
            >
              {t("ยกเลิก", "Cancel")}
            </button>
          )}
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {answer && (
        <div className="ai-answer" aria-live="polite">
          {answer}
        </div>
      )}
    </details>
  );
}
