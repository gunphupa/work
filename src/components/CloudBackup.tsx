import { useRef, useState } from "react";
import { Cloud, Download, Upload, RefreshCw, Trash2 } from "lucide-react";
import { useAccount } from "../auth";
import { useLanguage } from "../i18n";
import { downloadState } from "../domain/inventory";
import type { SavedState } from "../domain/schema";
import {
  cloudBackupError,
  cloudBackupMetadataSchema,
  cloudPayload,
  cloudPayloadBytes,
  parseCloudSnapshot,
  type CloudBackupMetadata,
  type CloudSnapshot,
} from "../domain/cloud-backup";

// Account changes remount the inner component, so an old account's preview can
// never be restored or used as the expected revision of a different account.
export function CloudBackup(props: {
  state: SavedState;
  onRestore: (state: SavedState) => void;
  disabled?: boolean;
}) {
  const account = useAccount();
  return <AccountBackup key={account.session?.user.id ?? "guest"} {...props} />;
}

function AccountBackup({
  state,
  onRestore,
  disabled = false,
}: {
  state: SavedState;
  onRestore: (state: SavedState) => void;
  disabled?: boolean;
}) {
  const { t, language } = useLanguage();
  const { client, session } = useAccount();
  const [snapshot, setSnapshot] = useState<CloudSnapshot | null>(null);
  const [recovery, setRecovery] = useState<
    (CloudBackupMetadata & { payload: unknown }) | null
  >(null);
  const backup = snapshot ?? recovery;
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const userId = session?.user.id;
  const date = (raw: string) =>
    new Date(raw).toLocaleString(language === "th" ? "th-TH" : "en-GB");

  function message(e: unknown) {
    const texts: Record<
      ReturnType<typeof cloudBackupError>,
      [string, string]
    > = {
      setup: [
        "ยังไม่เปิดใช้การสำรองบนบัญชี ผู้ดูแลต้องตั้งค่าระบบก่อน คุณยังส่งออกไฟล์ในเครื่องได้",
        "Account backups are not enabled yet. The owner needs to finish setup. Local file exports still work.",
      ],
      conflict: [
        "ข้อมูลบนบัญชีเปลี่ยนจากเครื่องอื่นแล้ว กดตรวจข้อมูลบนบัญชีอีกครั้งก่อนดำเนินการ",
        "The account backup changed on another device. Check the account backup again before continuing.",
      ],
      signin: [
        "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
        "Your session expired. Please sign in again.",
      ],
      invalid: [
        "ข้อมูลสำรองไม่ถูกต้องหรือใหญ่เกินกำหนด ข้อมูลในเครื่องยังอยู่",
        "The backup is invalid or too large. Your local data is unchanged.",
      ],
      service: [
        "เชื่อมต่อการสำรองไม่สำเร็จ ลองตรวจข้อมูลบนบัญชีอีกครั้ง ข้อมูลในเครื่องยังอยู่",
        "Could not complete the backup request. Check the account backup again. Your local data is unchanged.",
      ],
    };
    return t(...texts[cloudBackupError(e)]);
  }

  async function perform(action: () => Promise<void>) {
    if (inFlight.current || !client || !userId) return;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
      // A network failure could occur after a successful server write. Always
      // re-read before attempting another mutation, never guess its revision.
      setLoaded(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function read() {
    await perform(async () => {
      const { data, error: issue } = await client!
        .from("rebuild_private_backups")
        .select("revision,updated_at,payload")
        .eq("user_id", userId!)
        .maybeSingle();
      if (issue) throw issue;
      const metadata = data ? cloudBackupMetadataSchema.parse(data) : null;
      setRecovery(null);
      setSnapshot(null);
      if (metadata && data) {
        try {
          setSnapshot(parseCloudSnapshot(data));
        } catch {
          // Keep trustworthy owner-scoped metadata so an incompatible snapshot
          // can be downloaded for recovery or deleted without ever restoring it.
          setRecovery({ ...metadata, payload: data.payload });
          setError(
            t(
              "ข้อมูลบนบัญชีไม่เข้ากับรุ่นนี้ จึงโหลดเข้าเครื่องไม่ได้ ดาวน์โหลดไฟล์ต้นฉบับเก็บไว้ก่อนแทนที่หรือลบได้ ข้อมูลในเครื่องยังอยู่",
              "The account backup is incompatible with this version and cannot be restored. Download the original for recovery before replacing or deleting it. Your local data is unchanged.",
            ),
          );
        }
      }
      setLoaded(true);
      setNotice(t("ตรวจข้อมูลบนบัญชีแล้ว", "Account backup checked."));
    });
  }

  async function upload() {
    if (!loaded || disabled) return;
    if (
      !window.confirm(
        t(
          backup
            ? "แทนที่ข้อมูลสำรองบนบัญชีด้วยคลังและงานในเครื่องนี้ รวมรูปและบันทึก? ข้อมูลสำรองเดิมบนบัญชีจะถูกแทนที่"
            : "ส่งคลังและงานในเครื่องนี้ รวมรูปและบันทึก ไปเก็บเป็นข้อมูลส่วนตัวบนบัญชี?",
          backup
            ? "Replace the account backup with this browser’s inventory and builds, including item photos and notes? The previous account backup will be replaced."
            : "Upload this browser’s inventory and builds, including item photos and notes, as a private account backup?",
        ),
      )
    )
      return;
    await perform(async () => {
      const payload = cloudPayload(state);
      const { data, error: issue } = await client!.rpc("save_rebuild_backup", {
        expected_user_id: userId,
        new_payload: payload,
        expected_revision: backup?.revision ?? null,
      });
      if (issue) throw issue;
      const metadata = cloudBackupMetadataSchema.parse(
        Array.isArray(data) ? data[0] : data,
      );
      setSnapshot({ ...metadata, payload });
      setRecovery(null);
      setNotice(
        t(
          "สำรองบนบัญชีแล้ว ไม่มีการซิงก์อัตโนมัติ",
          "Account backup saved. Automatic syncing is off.",
        ),
      );
    });
  }

  function restore() {
    if (!snapshot || !loaded || disabled || busy) return;
    if (
      !window.confirm(
        t(
          "แทนที่คลังและงานในเครื่องนี้ด้วยข้อมูลสำรองบนบัญชี? ควรดาวน์โหลดข้อมูลในเครื่องเก็บไว้ก่อน แผนจากเว็บและข้อมูลวิจัยจะไม่เปลี่ยน",
          "Replace this browser’s inventory and catalogue builds with the account backup? Export your current local data first. External plans and research records will not change.",
        ),
      )
    )
      return;
    try {
      onRestore(cloudPayload(snapshot.payload));
      setNotice(
        t(
          "โหลดข้อมูลสำรองเข้าเครื่องแล้ว",
          "Account backup restored to this browser.",
        ),
      );
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }

  async function remove() {
    if (!backup || !loaded) return;
    if (
      !window.confirm(
        t(
          "ลบข้อมูลสำรองบนบัญชีนี้? คลังและงานในเครื่องจะยังอยู่",
          "Delete this account backup? Your local inventory and builds will remain.",
        ),
      )
    )
      return;
    await perform(async () => {
      const { data, error: issue } = await client!.rpc(
        "delete_rebuild_backup",
        {
          expected_user_id: userId,
          expected_revision: backup.revision,
        },
      );
      if (issue) throw issue;
      if (data !== true) throw Error("Invalid delete response");
      setSnapshot(null);
      setRecovery(null);
      setNotice(t("ลบข้อมูลสำรองบนบัญชีแล้ว", "Account backup deleted."));
    });
  }

  function downloadRecovery() {
    if (!recovery) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(recovery.payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "rebuild-account-backup-recovery.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="panel stack" aria-labelledby="cloud-backup-title">
      <h2 id="cloud-backup-title">
        <Cloud size={20} aria-hidden="true" />{" "}
        {t("สำรองข้อมูลบนบัญชี", "Account backup")}
      </h2>
      <p>
        {t(
          "เก็บคลังและงานใน ReBuild รวมรูปและบันทึกส่วนตัว เพื่อย้ายไปอีกเครื่อง คุณเลือกส่งและโหลดเอง ไม่มีการซิงก์อัตโนมัติ แผนจากอินเทอร์เน็ตและข้อมูลวิจัยมีไฟล์ส่งออกแยกและไม่รวมในส่วนนี้",
          "Transfer your inventory and catalogue builds, including item photos and private notes, between devices. Upload and restore manually; there is no automatic sync. External plans and research records have separate exports and are not included here.",
        )}
      </p>
      <p>
        {t(
          `ข้อมูลในเครื่องขณะนี้: ${state.inventory.length} รายการ · ${state.builds.length} งาน · ${(cloudPayloadBytes(state) / 1000).toFixed(1)} KB`,
          `Current local data: ${state.inventory.length} inventory items · ${state.builds.length} builds · ${(cloudPayloadBytes(state) / 1000).toFixed(1)} KB`,
        )}
      </p>
      <small>
        {t(
          "วันที่บนบัญชีแสดงเวลาที่สำรองล่าสุด ส่วนข้อมูลในเครื่องคือข้อมูลปัจจุบันที่แสดงอยู่ ไม่ได้บันทึกวันแก้ไขรวม",
          "The account timestamp records its last upload. Local counts reflect current browser data; no combined local modification date is recorded.",
        )}
      </small>
      {!session || !client ? (
        <p>
          <a href="#/account">
            {t(
              "เข้าสู่ระบบเพื่อใช้ข้อมูลสำรองบนบัญชี",
              "Sign in to use account backups",
            )}
          </a>
        </p>
      ) : (
        <>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void read()}
            >
              <RefreshCw size={17} />{" "}
              {t("ตรวจข้อมูลบนบัญชี", "Check account backup")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={disabled || busy}
              onClick={() => downloadState(state)}
            >
              <Download size={17} />{" "}
              {t("ดาวน์โหลดข้อมูลในเครื่อง", "Export local data")}
            </button>
          </div>
          {loaded && (
            <div className="stack">
              {snapshot ? (
                <p>
                  {t(
                    `ข้อมูลบนบัญชี: ${snapshot.payload.inventory.length} รายการ · ${snapshot.payload.builds.length} งาน · สำรองเมื่อ ${date(snapshot.updated_at)}`,
                    `Account backup: ${snapshot.payload.inventory.length} items · ${snapshot.payload.builds.length} builds · uploaded ${date(snapshot.updated_at)}`,
                  )}
                  <br />
                  <small>
                    {t("รุ่นสำรอง", "Backup revision")}:{" "}
                    {snapshot.revision.slice(0, 8)}
                  </small>
                </p>
              ) : recovery ? (
                <p>
                  {t("ข้อมูลสำรองที่ต้องกู้คืน", "Backup requiring recovery")} ·{" "}
                  {date(recovery.updated_at)} · {recovery.revision.slice(0, 8)}
                </p>
              ) : (
                <p>
                  {t(
                    "บัญชีนี้ยังไม่มีข้อมูลสำรอง",
                    "This account has no backup yet.",
                  )}
                </p>
              )}
              <div className="button-row">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || disabled}
                  onClick={() => void upload()}
                >
                  <Upload size={17} />{" "}
                  {t("สำรองข้อมูลในเครื่องไปบัญชี", "Upload local backup")}
                </button>
                {snapshot && (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy || disabled}
                      onClick={restore}
                    >
                      {t("โหลดจากบัญชีมาเครื่องนี้", "Restore account backup")}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => downloadState(snapshot.payload)}
                    >
                      <Download size={17} />{" "}
                      {t("ดาวน์โหลดไฟล์จากบัญชี", "Download account backup")}
                    </button>
                  </>
                )}
                {recovery && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={downloadRecovery}
                  >
                    <Download size={17} />{" "}
                    {t("ดาวน์โหลดไฟล์สำหรับกู้คืน", "Download recovery file")}
                  </button>
                )}
                {backup && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    <Trash2 size={17} />{" "}
                    {t("ลบข้อมูลสำรองบนบัญชี", "Delete account backup")}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {busy && (
        <p role="status">
          {t("กำลังติดต่อข้อมูลสำรอง…", "Contacting account backup…")}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {disabled && (
        <p>
          {t(
            "การบันทึกในเครื่องมีปัญหา แก้ไขหรือสำรองข้อมูลเดิมก่อนโหลดหรือส่งข้อมูลใหม่",
            "Local storage needs attention. Recover or export your original data before uploading or restoring.",
          )}
        </p>
      )}
    </section>
  );
}
