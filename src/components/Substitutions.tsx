import { useId, useState } from "react";
import { useLanguage } from "../i18n";
import { materialById } from "../data/materials";
import type { InventoryItem, Project, Requirement } from "../domain/schema";
import {
  getPaperBondingSubstitutions,
  getSubstitutions,
  paperBondingMaterials,
  type Substitution,
} from "../domain/substitutions";

function Suggestions({ suggestions }: { suggestions: Substitution[] }) {
  const { language, t } = useLanguage();
  return (
    <ul className="substitution-list">
      {suggestions.map((suggestion) => {
        const material = materialById[suggestion.materialId];
        return (
          <li className="substitution-card" key={suggestion.materialId}>
            <div className="substitution-heading">
              <strong>
                {material
                  ? t(material.name, material.en)
                  : suggestion.materialId}
              </strong>
              <span
                className={
                  suggestion.owned.length
                    ? "substitution-owned"
                    : "substitution-unowned"
                }
              >
                {suggestion.owned.length
                  ? t("มีในคลังของคุณ", "In your inventory")
                  : t("ยังไม่บันทึกว่ามี", "Not in your inventory")}
              </span>
            </div>
            {suggestion.owned.length > 0 && (
              <p className="form-hint">
                {suggestion.owned.map((item) => item.label).join(", ")}
                {suggestion.needsCheck
                  ? t(
                      " — ตรวจชนิด สภาพ และรายละเอียดก่อนใช้",
                      " — check type, condition and details first",
                    )
                  : ""}
              </p>
            )}
            <p>
              <strong>{suggestion.purpose[language]}</strong>
            </p>
            <p>{suggestion.how[language]}</p>
            <p className="substitution-limit">
              <strong>{t("เงื่อนไข: ", "Conditions: ")}</strong>
              {suggestion.limits[language]}
            </p>
            {suggestion.specs && (
              <p className="form-hint">
                {t("สเปกที่ต้องตรวจ: ", "Specifications to check: ")}
                {Object.entries(suggestion.specs)
                  .map(([key, values]) => `${key}: ${values.join(" / ")}`)
                  .join(" · ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function RequirementSubstitutions({
  project,
  requirement,
  inventory,
}: {
  project: Project;
  requirement: Requirement;
  inventory: InventoryItem[];
}) {
  const { t } = useLanguage();
  const suggestions = getSubstitutions(project, requirement, inventory);
  return (
    <details className="substitution-options">
      <summary>
        {t(
          "ไม่มีชิ้นนี้ ใช้อะไรแทนได้บ้าง?",
          "Missing this? See possible substitutes",
        )}
      </summary>
      {suggestions.length ? (
        <>
          <p className="form-hint">
            {t(
              "แสดงของที่คุณมีก่อน คำแนะนำใช้เฉพาะหน้าที่และเงื่อนไขด้านล่าง ตรวจปริมาณที่ต้องใช้ด้วย",
              "Your own items appear first. These suggestions apply only to the uses and conditions below; also check the amount needed.",
            )}
          </p>
          <Suggestions suggestions={suggestions} />
          <p className="form-hint">
            {t(
              "คำแนะนำไม่เปลี่ยนรายการเป็น “มีครบ” อัตโนมัติ และไม่ได้ยืนยันผลการทดสอบชิ้นงานจริง",
              "Suggestions do not automatically mark a requirement as complete or certify a physically tested result.",
            )}
          </p>
        </>
      ) : (
        <p className="form-hint">
          {project.category === "electronics"
            ? t(
                "ยังไม่มีตัวเลือกเพิ่มเติมที่ยืนยันไว้สำหรับจุดนี้ ใช้รุ่น ค่า และขาต่อที่คู่มือระบุ ไม่เปลี่ยนจากรูปร่างที่คล้ายกัน",
                "No additional alternative is recorded for this part. Follow the guide’s model, ratings and pinout; appearance alone does not establish compatibility.",
              )
            : t(
                "ยังไม่มีคำแนะนำที่เหมาะกับหน้าที่ของชิ้นนี้ในคู่มือนี้ ลองยืมหรือเตรียมของตามรายการ คุณยังอ่านทุกขั้นตอนต่อได้",
                "No suitable substitution is recorded for this use in this guide. Consider borrowing the listed item. Every step remains open.",
              )}
        </p>
      )}
    </details>
  );
}

export function PaperBondingSubstitutions({
  inventory,
}: {
  inventory: InventoryItem[];
}) {
  const { t } = useLanguage();
  const id = useId();
  const [missing, setMissing] = useState<string>("glue-stick");
  return (
    <details className="panel paper-substitutions">
      <summary>
        {t(
          "งานติดกระดาษ: ไม่มีกาว ใช้อะไรแทนได้?",
          "Paper bonding: what can replace missing glue?",
        )}
      </summary>
      <p>
        {t(
          "เลือกของที่ขาดสำหรับติดกระดาษกับกระดาษในงานแห้งและเบาเท่านั้น เช่น ป้ายกระดาษซ้อนหรืองานตกแต่ง คำแนะนำนี้ไม่ครอบคลุมทุกจุดของโปรเจกต์",
          "Choose the missing item for bonding paper to paper in a dry, lightweight craft, such as layered labels or decoration. This advice does not apply to every joint in a project.",
        )}
      </p>
      <label htmlFor={id}>{t("ของที่ไม่มี", "Missing item")}</label>
      <select
        id={id}
        value={missing}
        onChange={(event) => setMissing(event.target.value)}
      >
        {paperBondingMaterials.map((materialId) => {
          const material = materialById[materialId];
          return (
            <option key={materialId} value={materialId}>
              {material ? t(material.name, material.en) : materialId}
            </option>
          );
        })}
      </select>
      <Suggestions
        suggestions={getPaperBondingSubstitutions(missing, inventory)}
      />
      <p className="form-hint">
        {t(
          "แสดงของในคลังก่อน คำแนะนำตามเงื่อนไขไม่ได้เปลี่ยนความพร้อมของโปรเจกต์หรือยืนยันว่าชิ้นงานทดสอบผ่านแล้ว",
          "Inventory items appear first. Conditional advice does not change project readiness or certify that the build has passed testing.",
        )}
      </p>
    </details>
  );
}
