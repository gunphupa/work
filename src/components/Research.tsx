import { useEffect, useState } from "react";
import { ClipboardList, Download } from "lucide-react";
import { useLanguage } from "../i18n";
import {
  RESEARCH_CHANGED,
  RESEARCH_STORE,
  activeResearchSession,
  beginResearch,
  deleteResearchSession,
  discardResearchTask,
  downloadResearch,
  endResearch,
  finishResearchTask,
  readResearch,
  researchRecordingError,
  researchElapsedMs,
  researchSummary,
  researchTasks,
  startResearchTask,
  stopResearchTask,
  updateActiveResearch,
  type ResearchState,
  type ResearchTask,
} from "../domain/research";
import "./research.css";

const taskLabels: Record<ResearchTask, [string, string]> = {
  find_project: [
    "ค้นหาและเลือกโปรเจกต์ที่เหมาะสม",
    "Find and choose a suitable project",
  ],
  missing_materials: [
    "ระบุวัสดุที่ขาดและสิ่งที่ต้องตรวจสอบ",
    "Identify missing materials and checks",
  ],
  explain_steps: [
    "อธิบายขั้นตอนสำคัญและข้อควรระวัง",
    "Explain key steps and precautions",
  ],
  save_reopen: [
    "บันทึกแผน ออกจากหน้า แล้วเปิดกลับมา",
    "Save a plan, leave the page and reopen it",
  ],
};
const criteria: Record<ResearchTask, [string, string]> = {
  find_project: [
    "เลือกโปรเจกต์หนึ่งงาน เปิดแหล่งอ้างอิง และอธิบายว่าเหมาะกับวัสดุที่มีอย่างไร",
    "Choose one project, open its source and explain how it fits your materials.",
  ],
  missing_materials: [
    "บอกของที่ยังขาด และจุดที่ยังต้องตรวจขนาด สเปก หรือจำนวน โดยไม่ถือว่าวัสดุชื่อคล้ายกันใช้แทนได้ทันที",
    "Identify missing supplies and required size, specification or quantity checks without assuming similar names mean interchangeable materials.",
  ],
  explain_steps: [
    "อธิบายลำดับการทำงานหลักด้วยคำของตนเอง พร้อมข้อควรระวังจากคู่มือ โดยยังไม่จำเป็นต้องสร้างชิ้นงานจริง",
    "Explain the main sequence in your own words and a precaution from the guide. Building the physical object is not required for this task.",
  ],
  save_reopen: [
    "บันทึกแผน เปิดหน้าอื่น แล้วเปิดแผนเดิมได้ พร้อมตรวจว่าขั้นตอนและบันทึกยังอยู่",
    "Save a plan, navigate elsewhere and reopen the same plan, checking that its steps and notes remain.",
  ],
};
function load() {
  try {
    return { state: readResearch(), error: "" };
  } catch {
    return {
      state: { version: 1, sessions: [] } as ResearchState,
      error: "storage",
    };
  }
}
export function Research({ release: suppliedRelease }: { release?: string }) {
  const { t } = useLanguage();
  const [snapshot, setSnapshot] = useState(load);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [release, setRelease] = useState(suppliedRelease ?? "unknown");
  const [participant, setParticipant] = useState("");
  const [phase, setPhase] = useState<"pilot" | "main">("pilot");
  const [consent, setConsent] = useState(false);
  const [task, setTask] = useState<ResearchTask>("find_project");
  const [outcome, setOutcome] = useState<
    "" | "success" | "failure" | "abandoned"
  >("");
  const [assistance, setAssistance] = useState("0");
  const [errors, setErrors] = useState("0");
  const [note, setNote] = useState("");
  const [ratings, setRatings] = useState({
    usefulness: "",
    clarity: "",
    ease: "",
  });
  const [comment, setComment] = useState("");
  const [, setNow] = useState(Date.now);
  const active = activeResearchSession(snapshot.state);
  useEffect(() => {
    setOutcome("");
    setNote("");
    setAssistance("0");
    setErrors("0");
  }, [active?.id, active?.running?.id]);
  useEffect(() => {
    setRatings({ usefulness: "", clarity: "", ease: "" });
    setComment("");
  }, [active?.id]);
  useEffect(() => {
    const sync = (event?: Event) => {
      if (
        event instanceof StorageEvent &&
        event.key !== RESEARCH_STORE &&
        event.key !== null
      )
        return;
      setSnapshot(load());
      if (researchRecordingError()) setError("recording");
    };
    window.addEventListener("storage", sync);
    window.addEventListener(RESEARCH_CHANGED, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(RESEARCH_CHANGED, sync);
    };
  }, []);
  useEffect(() => {
    if (suppliedRelease) return;
    const abort = new AbortController();
    void fetch("/api/health", { signal: abort.signal })
      .then((r) => r.json())
      .then((data: { release?: string }) => {
        if (
          typeof data.release === "string" &&
          /^[a-zA-Z0-9._-]{1,80}$/.test(data.release)
        )
          setRelease(data.release);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [suppliedRelease]);
  useEffect(() => {
    if (!active?.running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active?.running]);
  function run(action: () => unknown, message = "") {
    try {
      action();
      setSnapshot(load());
      setError("");
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "storage");
      setSnapshot(load());
      return false;
    }
  }
  function exportRaw() {
    run(() => {
      const raw = localStorage.getItem(RESEARCH_STORE);
      if (!raw) return;
      const url = URL.createObjectURL(
        new Blob([raw], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "rebuild-research-recovery.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function clearAll() {
    if (
      !confirm(
        t(
          "ถอนความยินยอมและลบข้อมูลการทดสอบทั้งหมดในเบราว์เซอร์นี้? ไฟล์ที่เคยส่งออกจะไม่ถูกลบ",
          "Withdraw consent and delete all research data in this browser? Previously exported files will remain.",
        ),
      )
    )
      return;
    run(
      () => {
        localStorage.removeItem(RESEARCH_STORE);
        window.dispatchEvent(new Event(RESEARCH_CHANGED));
      },
      t("ลบข้อมูลและหยุดบันทึกแล้ว", "Data deleted and recording stopped."),
    );
  }
  const message =
    error === "research_session_changed" || error === "research_task_changed"
      ? t(
          "การทดสอบหรือภารกิจเปลี่ยนในอีกแท็บ ข้อมูลจากฟอร์มเดิมไม่ได้ถูกบันทึก กรุณาตรวจภารกิจปัจจุบัน",
          "The session or task changed in another tab. The old form was not saved. Check the current task.",
        )
      : error === "research_clock_invalid"
        ? t(
            "เวลาของเครื่องเปลี่ยนหรือจับเวลาเกิน 24 ชั่วโมง ยกเลิกตัวจับเวลานี้แล้วเริ่มใหม่ ไม่บันทึกเวลาที่ไม่ถูกต้อง",
            "The device clock changed or the task exceeded 24 hours. Discard this timer and start again; no invalid duration was recorded.",
          )
        : error === "research_task_running"
          ? t(
              "กรุณาจบหรือยกเลิกภารกิจที่กำลังจับเวลาก่อน",
              "Finish or discard the running task first.",
            )
          : t(
              "บันทึกไม่สำเร็จหรือข้อมูลเดิมอ่านไม่ได้ ข้อมูลเดิมไม่ได้ถูกแทนที่ ตรวจพื้นที่เก็บข้อมูลและส่งออกก่อนลบ อาจถึงจำนวนสูงสุด 50 ครั้งทดสอบ, 40 ภารกิจ หรือ 200 เหตุการณ์ต่อครั้ง",
              "Recording failed or existing data could not be read. Existing data was not replaced. Check browser storage and export before deleting. Limits: 50 sessions, 40 tasks and 200 events per session.",
            );
  return (
    <div className="research-page stack">
      <header>
        <span className="eyebrow">
          <ClipboardList size={18} />{" "}
          {t("การประเมินต้นแบบ", "PROTOTYPE EVALUATION")}
        </span>
        <h1>{t("บันทึกการทดสอบ", "Research task recorder")}</h1>
        <p>
          {t(
            "ใช้เก็บผลจากการใช้งานจริงตามเกณฑ์ที่ตกลงกัน ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น ผู้ทดลองต้องส่งออกไฟล์ให้ผู้วิจัยเอง",
            "Record actual use against agreed criteria. Data stays in this browser only. Participants must export and share their files with the researcher themselves.",
          )}
        </p>
        <p className="muted">
          {t("รุ่นเว็บไซต์", "Website release")}:{" "}
          <code>{suppliedRelease ?? release}</code> ·{" "}
          {t(
            "การจับเวลารวมเวลาที่ออกไปหน้าอื่นด้วย หากรีโหลดหรือเปลี่ยนแท็บที่จับเวลา จะใช้เวลาจากนาฬิกาเครื่อง อย่าเปลี่ยนเวลาเครื่องระหว่างทดสอบ",
            "Timers include time on other pages. After a reload or switching the recording tab, the device clock is used; do not change it during a test.",
          )}
        </p>
      </header>
      {(error || snapshot.error) && (
        <div role="alert" className="research-alert">
          {message}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {snapshot.error ? (
        <section className="panel stack">
          <p>
            {t(
              "ข้อมูลเดิมยังถูกเก็บไว้ ดาวน์โหลดไฟล์กู้คืนก่อนเริ่มใหม่",
              "Existing data is preserved. Download a recovery file before starting over.",
            )}
          </p>
          <div className="button-row">
            <button onClick={exportRaw}>
              {t("ดาวน์โหลดข้อมูลเดิม", "Download original data")}
            </button>
            <button onClick={clearAll}>
              {t("ลบและเริ่มใหม่", "Delete and start over")}
            </button>
          </div>
        </section>
      ) : !active ? (
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!consent) return;
            if (
              run(
                () =>
                  beginResearch(participant, phase, suppliedRelease ?? release),
                t(
                  "เริ่มบันทึกหลังได้รับความยินยอมแล้ว",
                  "Recording started after consent.",
                ),
              )
            ) {
              setConsent(false);
              setRatings({ usefulness: "", clarity: "", ease: "" });
              setComment("");
            }
          }}
        >
          <h2>{t("ก่อนเริ่มทดสอบ", "Before you start")}</h2>
          <p>
            {t(
              "การเข้าร่วมเป็นความสมัครใจ คุณหยุดหรือถอนตัวและลบข้อมูลในเครื่องได้ทุกเมื่อ การปฏิเสธไม่กระทบการใช้เว็บไซต์ ผู้วิจัยควรอธิบายเป้าหมายและภารกิจให้ตรงกันก่อนเริ่ม",
              "Participation is voluntary. You can stop, withdraw and delete local data at any time. Declining does not affect website access. The researcher should explain the purpose and use consistent task instructions before starting.",
            )}
          </p>
          <p>
            {t(
              "เมื่อยินยอม จะบันทึกรหัสผู้เข้าร่วม รุ่นเว็บไซต์ เวลาภารกิจ ผลที่คุณระบุ และเหตุการณ์ค้นหา/บันทึกแผนที่ระบบรองรับ ไม่เก็บข้อความค้นหา ชื่อวัสดุ รูปภาพ หรือบัญชีในบันทึกวิจัยนี้ อย่าใส่ชื่อจริง อีเมล หรือข้อมูลส่วนตัวในช่องความคิดเห็น",
              "With consent, this records your participant code, website release, task times, your reported outcomes, and supported search/plan events. This research record excludes search text, material names, photos and account details. Do not enter names, email addresses or personal details in comments.",
            )}
          </p>
          <div className="research-fields">
            <label>
              {t(
                "รหัสที่ผู้วิจัยกำหนด เช่น P01",
                "Researcher-assigned code, e.g. P01",
              )}
              <input
                required
                value={participant}
                maxLength={5}
                pattern="[Pp][0-9]{2,4}"
                autoComplete="off"
                onChange={(e) => setParticipant(e.target.value.toUpperCase())}
                placeholder="P01"
              />
            </label>
            <label>
              {t("ประเภทการทดสอบ", "Study stage")}
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as "pilot" | "main")}
              >
                <option value="pilot">{t("ทดลองนำร่อง", "Pilot")}</option>
                <option value="main">
                  {t("เก็บข้อมูลรอบหลัก", "Main study")}
                </option>
              </select>
            </label>
          </div>
          <label className="research-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span>
              {t(
                "ฉันเข้าใจและยินยอมให้บันทึกข้อมูลตามข้อความข้างต้นในเบราว์เซอร์นี้",
                "I understand and consent to the local recording described above.",
              )}
            </span>
          </label>
          <button className="primary" disabled={!consent}>
            {t("ยินยอมและเริ่มบันทึก", "Consent and start recording")}
          </button>
        </form>
      ) : (
        <>
          <section className="panel stack">
            <h2>
              {t("กำลังบันทึก", "Recording")}: {active.participant} ·{" "}
              {active.phase === "pilot"
                ? t("นำร่อง", "Pilot")
                : t("รอบหลัก", "Main study")}
            </h2>
            <p>
              {t(
                "เกณฑ์ต่อไปนี้เป็นภารกิจประเมินการใช้เว็บ ไม่ใช่หลักฐานว่าผู้ใช้สร้างชิ้นงานสำเร็จจริง ให้ผู้สังเกตหรือผู้ทดลองบันทึกผลตามที่เกิดขึ้น",
                "These tasks evaluate website use; they do not establish successful physical construction. The observer or participant should record what actually happened.",
              )}
            </p>
            {!active.running ? (
              <>
                <label>
                  {t("เลือกภารกิจ", "Choose a task")}
                  <select
                    value={task}
                    onChange={(e) => setTask(e.target.value as ResearchTask)}
                  >
                    {researchTasks.map((key) => (
                      <option value={key} key={key}>
                        {t(...taskLabels[key])}
                      </option>
                    ))}
                  </select>
                </label>
                <p>{t(...criteria[task])}</p>
                <button
                  className="primary"
                  onClick={() => run(() => startResearchTask(task, active.id))}
                >
                  {t("เริ่มจับเวลาภารกิจ", "Start task timer")}
                </button>
              </>
            ) : (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!outcome) return;
                  if (
                    run(
                      () =>
                        finishResearchTask(
                          {
                            outcome,
                            assistance: Number(assistance),
                            errors: Number(errors),
                            note,
                          },
                          active.id,
                          active.running!.id,
                        ),
                      t("บันทึกผลภารกิจแล้ว", "Task observation saved."),
                    )
                  ) {
                    setNote("");
                    setOutcome("");
                    setAssistance("0");
                    setErrors("0");
                  }
                }}
              >
                <h3>{t(...taskLabels[active.running.task])}</h3>
                <p>{t(...criteria[active.running.task])}</p>
                <p className="research-timer">
                  {Math.floor(researchElapsedMs(active.running) / 1000)}{" "}
                  {t("วินาที", "seconds")}
                </p>
                {!active.running.stoppedAt ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      run(() => stopResearchTask(active.id, active.running!.id))
                    }
                  >
                    {t("หยุดจับเวลาเมื่อทำภารกิจจบ", "Stop task timer")}
                  </button>
                ) : (
                  <p role="status">
                    {t(
                      "หยุดเวลาแล้ว กรอกผลด้านล่างได้โดยไม่เพิ่มเวลาภารกิจ",
                      "Timer stopped. Completing the observation below will not add to the task time.",
                    )}
                  </p>
                )}
                <div className="button-row">
                  <a href="#/web-projects">
                    {t("ไปค้นหาโปรเจกต์", "Find a project")}
                  </a>
                  <a href="#/builds">
                    {t("ไปงานที่บันทึก", "Open saved plans")}
                  </a>
                </div>
                <fieldset
                  disabled={!active.running.stoppedAt}
                  className="stack"
                >
                  <legend>
                    {t(
                      "บันทึกหลังหยุดจับเวลา",
                      "Observation after stopping the timer",
                    )}
                  </legend>
                  <div className="research-fields">
                    <label>
                      {t("ผลที่สังเกตได้", "Observed outcome")}
                      <select
                        required
                        value={outcome}
                        onChange={(e) =>
                          setOutcome(e.target.value as typeof outcome)
                        }
                      >
                        <option value="">
                          {t(
                            "เลือกผลตามที่สังเกตได้",
                            "Choose observed outcome",
                          )}
                        </option>
                        <option value="success">
                          {t("สำเร็จตามเกณฑ์", "Met the criteria")}
                        </option>
                        <option value="failure">
                          {t("ไม่สำเร็จตามเกณฑ์", "Did not meet the criteria")}
                        </option>
                        <option value="abandoned">
                          {t("หยุดทำภารกิจ", "Abandoned task")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {t(
                        "ได้รับความช่วยเหลือกี่ครั้ง",
                        "Help received (count)",
                      )}
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={assistance}
                        onChange={(e) => setAssistance(e.target.value)}
                      />
                    </label>
                    <label>
                      {t(
                        "ข้อผิดพลาดที่สังเกตได้ (ครั้ง)",
                        "Observed errors (count)",
                      )}
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={errors}
                        onChange={(e) => setErrors(e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    {t(
                      "สิ่งที่เกิดขึ้น / หลักฐานประกอบ (ไม่ใส่ข้อมูลส่วนตัว)",
                      "Observation / supporting evidence (no personal data)",
                    )}
                    <textarea
                      value={note}
                      maxLength={1000}
                      rows={3}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                </fieldset>
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={!active.running.stoppedAt}
                  >
                    {t("บันทึกผลภารกิจ", "Save task outcome")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          t(
                            "ทิ้งเวลาภารกิจนี้โดยไม่บันทึกผล?",
                            "Discard this timer without recording an outcome?",
                          ),
                        )
                      )
                        run(() =>
                          discardResearchTask(active.id, active.running!.id),
                        );
                    }}
                  >
                    {t("ทิ้งตัวจับเวลานี้", "Discard timer")}
                  </button>
                </div>
              </form>
            )}
          </section>
          <form
            className="panel stack"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  updateActiveResearch(
                    (s) => ({
                      ...s,
                      feedback: {
                        usefulness: Number(ratings.usefulness),
                        clarity: Number(ratings.clarity),
                        ease: Number(ratings.ease),
                        comment,
                        at: new Date().toISOString(),
                      },
                    }),
                    active.id,
                  ),
                t("บันทึกความคิดเห็นแล้ว", "Feedback saved."),
              );
            }}
          >
            <h2>{t("ความคิดเห็นหลังใช้งาน", "Post-use feedback")}</h2>
            <p>
              {t(
                "แบบประเมินสั้นที่ผู้พัฒนาออกแบบเอง ไม่ใช่แบบวัดมาตรฐานที่ผ่านการตรวจสอบ: 1 = น้อยที่สุด, 5 = มากที่สุด",
                "A short developer-designed questionnaire, not a validated standard scale: 1 = lowest, 5 = highest.",
              )}
            </p>
            {active.feedback && (
              <p>
                {t(
                  "มีความคิดเห็นบันทึกไว้แล้ว การส่งอีกครั้งจะแทนที่คำตอบเดิม",
                  "Feedback already exists. Submitting again replaces the previous answers.",
                )}
              </p>
            )}
            <div className="research-fields">
              {(
                [
                  [
                    "usefulness",
                    "ประโยชน์ต่อการวางแผน",
                    "Usefulness for planning",
                  ],
                  ["clarity", "ความชัดเจนของข้อมูล", "Clarity of information"],
                  ["ease", "ความง่ายในการใช้งาน", "Ease of use"],
                ] as const
              ).map(([key, th, en]) => (
                <label key={key}>
                  {t(th, en)}
                  <select
                    required
                    value={ratings[key]}
                    onChange={(e) =>
                      setRatings({ ...ratings, [key]: e.target.value })
                    }
                  >
                    <option value="">
                      {t("เลือกคะแนน", "Choose a rating")}
                    </option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label>
              {t(
                "อะไรเข้าใจยาก / ควรปรับปรุง (ไม่ใส่ข้อมูลส่วนตัว)",
                "What was confusing / should improve (no personal data)",
              )}
              <textarea
                rows={3}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <button>{t("บันทึกความคิดเห็น", "Save feedback")}</button>
          </form>
          <div className="button-row">
            <button
              disabled={!!active.running}
              onClick={() =>
                run(
                  () => endResearch(active.id),
                  t(
                    "จบการทดสอบแล้ว หยุดเก็บเหตุการณ์เพิ่มเติม",
                    "Session ended. Further event recording stopped.",
                  ),
                )
              }
            >
              {t("จบการทดสอบและหยุดบันทึก", "End session and stop recording")}
            </button>
            <button
              onClick={() => {
                if (
                  confirm(
                    t(
                      "ถอนตัวและลบข้อมูลของการทดสอบครั้งนี้?",
                      "Withdraw and delete this session’s data?",
                    ),
                  )
                )
                  run(() => deleteResearchSession(active.id));
              }}
            >
              {t(
                "ถอนตัวและลบข้อมูลครั้งนี้",
                "Withdraw and delete this session",
              )}
            </button>
          </div>
        </>
      )}
      {!snapshot.error && snapshot.state.sessions.length > 0 && (
        <section className="panel stack">
          <h2>
            {t("ข้อมูลที่บันทึกในเบราว์เซอร์นี้", "Records in this browser")}
          </h2>
          <p>
            {t(
              "สรุปเฉพาะภารกิจที่กดบันทึกผลแล้ว รวมครั้งที่ทำซ้ำ ไม่รวมตัวจับเวลาที่ยังไม่จบ รหัสไม่ใช่การยืนยันจำนวนคนจริง และไม่ควรสรุปแทนผู้ใช้ทั่วไปจากกลุ่มเพื่อนเพียงกลุ่มเดียว",
              "Summaries use saved task observations, including repeated attempts, and exclude unfinished timers. Codes do not verify distinct people; results from a friend sample should not be generalized to all users.",
            )}
          </p>
          <div className="research-summary">
            {researchSummary(snapshot.state.sessions).map((summary) => (
              <div key={summary.phase}>
                <h3>
                  {summary.phase === "pilot"
                    ? t("นำร่อง", "Pilot")
                    : t("รอบหลัก", "Main study")}
                </h3>
                <p>
                  {t(
                    `${summary.participantCodes} รหัส · ${summary.sessions} ครั้งทดสอบ · ${summary.attempts} ภารกิจ`,
                    `${summary.participantCodes} codes · ${summary.sessions} sessions · ${summary.attempts} task attempts`,
                  )}
                </p>
                <p>
                  {t("สำเร็จ", "Successful")}: {summary.successes}/
                  {summary.attempts}{" "}
                  {summary.successRate === null
                    ? "—"
                    : `(${summary.successRate.toFixed(1)}%)`}
                </p>
                <p>
                  {t("เวลาเฉลี่ยต่อภารกิจ", "Mean time per task")}:{" "}
                  {summary.meanSeconds === null
                    ? "—"
                    : `${summary.meanSeconds.toFixed(1)} ${t("วินาที", "s")}`}
                </p>
              </div>
            ))}
          </div>
          <p className="muted">
            {t(
              "ค่าเฉลี่ยรวมนี้รวมภารกิจต่างชนิด ควรแยกวิเคราะห์ตามภารกิจในไฟล์ส่งออกด้วย",
              "This overall mean mixes task types. Also analyze each task separately in the exported data.",
            )}
          </p>
          <div className="button-row">
            <button
              onClick={() => run(() => downloadResearch(snapshot.state, "csv"))}
            >
              <Download size={16} /> {t("ส่งออก CSV", "Export CSV")}
            </button>
            <button
              onClick={() =>
                run(() => downloadResearch(snapshot.state, "json"))
              }
            >
              {t("ส่งออก JSON", "Export JSON")}
            </button>
          </div>
          {snapshot.state.sessions.map((s) => (
            <details key={s.id} className="research-session">
              <summary>
                {s.participant} · {s.phase} ·{" "}
                {new Date(s.consentedAt).toLocaleString()} ·{" "}
                {s.observations.length} {t("ภารกิจ", "tasks")}
                {s.id === snapshot.state.activeId
                  ? ` · ${t("กำลังบันทึก", "recording")}`
                  : ""}
              </summary>
              <p>
                {t("รุ่น", "Release")}: {s.release} · {s.events.length}{" "}
                {t("เหตุการณ์", "events")}
              </p>
              <ul>
                {s.observations.map((o) => (
                  <li key={o.id}>
                    {t(...taskLabels[o.task])}:{" "}
                    {o.outcome === "success"
                      ? t("สำเร็จ", "success")
                      : o.outcome === "failure"
                        ? t("ไม่สำเร็จ", "failure")
                        : t("หยุดทำ", "abandoned")}{" "}
                    · {(o.elapsedMs / 1000).toFixed(1)} {t("วินาที", "s")} ·{" "}
                    {t(
                      `ช่วย ${o.assistance} ครั้ง / ผิดพลาด ${o.errors} ครั้ง`,
                      `${o.assistance} help / ${o.errors} errors`,
                    )}
                    {o.note && <p>{o.note}</p>}
                  </li>
                ))}
              </ul>
              {s.feedback && (
                <p>
                  {t("ความคิดเห็น", "Feedback")}: {s.feedback.comment || "—"} (
                  {s.feedback.usefulness}/5, {s.feedback.clarity}/5,{" "}
                  {s.feedback.ease}/5)
                </p>
              )}
              <div className="button-row">
                <button
                  onClick={() =>
                    run(() =>
                      downloadResearch({ version: 1, sessions: [s] }, "csv"),
                    )
                  }
                >
                  {t("ส่งออกครั้งนี้", "Export this session")}
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        t(
                          "ลบข้อมูลการทดสอบครั้งนี้? ไฟล์ที่เคยส่งออกยังอยู่",
                          "Delete this research session? Existing exports will remain.",
                        ),
                      )
                    )
                      run(() => deleteResearchSession(s.id));
                  }}
                >
                  {t("ลบครั้งนี้", "Delete session")}
                </button>
              </div>
            </details>
          ))}
          <button onClick={clearAll}>
            {t(
              "ลบข้อมูลวิจัยทั้งหมดในเครื่องนี้",
              "Delete all local research data",
            )}
          </button>
        </section>
      )}
    </div>
  );
}

/** Visible consent/timer reminder on every route; mounting does not start recording. */
export function ResearchIndicator() {
  const { t } = useLanguage();
  const [snapshot, setSnapshot] = useState(load);
  const [error, setError] = useState("");
  const [, tick] = useState(0);
  const active = activeResearchSession(snapshot.state);
  useEffect(() => {
    const sync = () => {
      setSnapshot(load());
      setError(researchRecordingError());
    };
    window.addEventListener("storage", sync);
    window.addEventListener(RESEARCH_CHANGED, sync);
    const timer = setInterval(() => tick((v) => v + 1), 1000);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(RESEARCH_CHANGED, sync);
      clearInterval(timer);
    };
  }, []);
  if (!active) return null;
  return (
    <aside
      className="research-indicator"
      aria-label={t("สถานะการบันทึกวิจัย", "Research recording status")}
    >
      <span>
        {t("กำลังบันทึกการทดสอบในเครื่อง", "Local study recording active")}:{" "}
        <strong>{active.participant}</strong>
        {active.running && (
          <>
            {" "}
            · {t(...taskLabels[active.running.task])}:{" "}
            {Math.floor(researchElapsedMs(active.running) / 1000)}{" "}
            {t("วินาที", "s")}
            {active.running.stoppedAt
              ? ` (${t("หยุดเวลาแล้ว", "timer stopped")})`
              : ""}
          </>
        )}
      </span>
      <a href="#/research">{t("กลับไปบันทึกผล", "Return to task recorder")}</a>
      <button
        type="button"
        onClick={() => {
          if (
            active.running &&
            !confirm(
              t(
                "หยุดบันทึกและทิ้งภารกิจที่ยังไม่ได้บันทึกผล? ผลก่อนหน้านี้ยังอยู่",
                "Stop recording and discard the unfinished task? Previous observations will be kept.",
              ),
            )
          )
            return;
          try {
            endResearch(active.id, true);
            setError("");
          } catch {
            setError("storage");
          }
        }}
      >
        {t("หยุดบันทึก", "Stop recording")}
      </button>
      {error && (
        <p role="alert">
          {t(
            "บันทึกเหตุการณ์ไม่สำเร็จ กลับไปหน้าบันทึกการทดสอบเพื่อตรวจสอบ",
            "An event could not be recorded. Open the task recorder to check storage.",
          )}
        </p>
      )}
    </aside>
  );
}
