import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, MessageCircle, LoaderCircle } from "lucide-react";
import { useLanguage } from "../i18n";
import {
  externalHelpContext,
  externalHelpReply,
} from "../domain/external-help";
import type { WebProject, WebSource } from "../domain/web-projects";
import "./external-project-help.css";

export function ExternalProjectHelp({
  project,
  sources,
}: {
  project: WebProject;
  sources: WebSource[];
}) {
  const { t, language } = useLanguage();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<{
    question: string;
    reply: string;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function ask(event: FormEvent) {
    event.preventDefault();
    if (busy || !question.trim()) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setAnswer(null);
    const timer = setTimeout(() => abort.abort("timeout"), 35000);
    try {
      const context = externalHelpContext(project, sources);
      const session = await fetch("/api/session", { signal: abort.signal });
      if (!session.ok)
        throw Error(
          t(
            "เริ่มเซสชันไม่สำเร็จ ลองใหม่ภายหลัง",
            "Could not start a session. Try again later.",
          ),
        );
      const { csrf } = await session.json();
      const response = await fetch("/api/ai", {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          mode: "help",
          language,
          text: question.trim(),
          externalProject: context,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: t(
            "คำถามหรือข้อมูลคู่มือยาวเกินไปหรือไม่สมบูรณ์ ลองย่อคำถาม",
            "The question or guide context is too large or incomplete. Try a shorter question.",
          ),
          403: t(
            "เซสชันหมดอายุ รีเฟรชแล้วลองใหม่",
            "Your session expired. Refresh and try again.",
          ),
          429: t(
            "ถึงโควตา AI หรือระบบกำลังทำงานเต็มจำนวน โปรดลองภายหลัง",
            "The AI allowance has been reached or the service is busy. Try again later.",
          ),
          503: t(
            "AI ยังไม่พร้อมใช้งาน คู่มือและแผนยังเปิดอ่านได้",
            "AI is unavailable. Your guide and saved plan remain available.",
          ),
          504: t(
            "AI ตอบช้าเกินไป โปรดลองใหม่",
            "The answer timed out. Please try again.",
          ),
        };
        throw Error(
          messages[response.status] ??
            t(
              "รับคำตอบไม่สำเร็จ โปรดลองภายหลัง",
              "Could not get an answer. Try again later.",
            ),
        );
      }
      if (
        typeof body.reply !== "string" ||
        body.reply.length > 6000 ||
        !body.reply.trim()
      )
        throw Error(
          t(
            "คำตอบไม่สมบูรณ์ โปรดลองใหม่",
            "The answer was incomplete. Please try again.",
          ),
        );
      if (!abort.signal.aborted)
        setAnswer({
          question: question.trim(),
          reply: externalHelpReply(body.reply, language),
        });
    } catch (cause) {
      setError(
        abort.signal.aborted
          ? abort.signal.reason === "timeout"
            ? t(
                "AI ตอบช้าเกินไป ลองใหม่ได้ แผนไม่ได้เปลี่ยน",
                "The answer timed out. You can retry; your plan is unchanged.",
              )
            : t("ยกเลิกคำถามแล้ว", "Question cancelled.")
          : cause instanceof Error
            ? cause.message
            : t("รับคำตอบไม่สำเร็จ", "Could not get an answer."),
      );
    } finally {
      clearTimeout(timer);
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const original = sources.find((source) => source.id === project.sourceId);
  return (
    <details className="external-project-help panel">
      <summary>
        <MessageCircle size={18} />{" "}
        {t("ถาม AI เกี่ยวกับโปรเจกต์นี้", "Ask AI about this project")}
      </summary>
      <div className="stack">
        <p>
          {t(
            "ถามให้ช่วยอธิบายขั้นตอนหรือสิ่งที่ต้องตรวจจากแผนนี้ คำตอบเพิ่มเติมอาจเป็นข้อเสนอที่ยังไม่ได้ทดลอง และไม่ได้ค้นเว็บใหม่",
            "Ask for an explanation of these steps or checks. Additional suggestions may be untested; this does not run a new web search.",
          )}
        </p>
        <form onSubmit={(event) => void ask(event)} className="stack">
          <label>
            {t("คำถามเกี่ยวกับโปรเจกต์", "Question about this project")}
            <textarea
              rows={3}
              maxLength={4000}
              required
              disabled={busy}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t(
                "เช่น ขั้นตอนที่ 2 หมายความว่าอย่างไร ต้องตรวจอะไรบ้างก่อนทำ?",
                "For example: What does step 2 mean, and what should I check first?",
              )}
            />
          </label>
          <p className="form-hint">
            {t(
              "เมื่อกดถาม คำถามและข้อมูลคู่มือที่แสดง (ชื่อ วัสดุ ขั้นตอน ข้อควรระวัง และแหล่งอ้างอิง) จะส่งให้ OpenAI และใช้โควตา AI บันทึกส่วนตัว รูป และข้อมูลในคลังไม่ถูกแนบไป คำตอบไม่แก้แผนให้คุณ",
              "Asking sends your question and the displayed guide snapshot (title, materials, steps, cautions and sources) to OpenAI and uses the AI allowance. Private notes, photos and your inventory are not attached. Answers do not edit your plan.",
            )}
          </p>
          <div className="button-row">
            <button
              className="secondary"
              type="submit"
              disabled={busy || !question.trim()}
            >
              {busy ? (
                <>
                  <LoaderCircle size={16} className="spinner" />{" "}
                  {t("กำลังตอบ…", "Answering…")}
                </>
              ) : (
                t("ถามเกี่ยวกับแผนนี้", "Ask about this plan")
              )}
            </button>
            {busy && (
              <button
                className="text-link"
                type="button"
                onClick={() => controller.current?.abort()}
              >
                {t("ยกเลิกคำถาม", "Cancel question")}
              </button>
            )}
          </div>
        </form>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {answer && (
          <section
            aria-label={t("คำอธิบายจาก AI", "AI explanation")}
            className="stack"
          >
            <p>
              <strong>{t("คำถาม: ", "Question: ")}</strong>
              {answer.question}
            </p>
            <p className="external-help-answer">{answer.reply}</p>
            <p className="form-hint">
              {t(
                "AI อธิบายจากข้อมูลสรุปที่บันทึกไว้ ไม่ใช่ผลทดสอบชิ้นงาน ตรวจคู่มือต้นฉบับก่อนทำ หากขนาด สเปก หรือความปลอดภัยยังไม่ชัด อย่าเดาแทนข้อมูลจริง",
                "AI explains the saved summary; this is not a physical test result. Check the original tutorial before building. Do not guess missing dimensions, specifications or safety information.",
              )}
            </p>
            {original && (
              <a
                className="text-link"
                href={original.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("เปิดคู่มือต้นฉบับ", "Open original tutorial")}{" "}
                <ArrowUpRight size={15} />
              </a>
            )}
          </section>
        )}
      </div>
    </details>
  );
}
