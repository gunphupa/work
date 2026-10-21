import { useState } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { projectsForMaterials } from "../domain/material-projects";
import { localizeProject } from "../data/projects";
import { materialById } from "../data/materials";
import { useLanguage } from "../i18n";
import type { InventoryItem } from "../domain/schema";
const specNames: Record<string, string> = {
  model: "Model",
  connector: "Connector",
  data: "Data transfer",
  ide: "IDE installed",
  type: "Type",
  ohms: "Resistance (Ω)",
  template: "Template",
  metric: "Metric markings",
  voltage: "Voltage (V)",
  cap: "Matching cap",
  capacity: "Capacity",
  opening: "Mesh opening",
};

export function MaterialProjects({
  items,
  inventory,
  openInNewTab = false,
}: {
  items: InventoryItem[];
  inventory: InventoryItem[];
  openInNewTab?: boolean;
}) {
  const { t, language } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const matches = projectsForMaterials(items, inventory);
  const uncovered = items.filter(
    (item) =>
      !matches.some((m) => m.matchedMaterialIds.includes(item.materialId)),
  );
  return (
    <section
      className="material-projects"
      aria-label={t(
        "โปรเจกต์ที่ใช้ของเหล่านี้",
        "Projects using these materials",
      )}
    >
      <div className="discovery-heading">
        <BookOpen size={22} />
        <div>
          <h3>
            {t("โปรเจกต์ที่ใช้ของเหล่านี้", "Projects using these materials")}
          </h3>
          <p>
            {t(
              "จากคู่มือใน ReBuild เปิดอ่านได้แม้ของยังไม่ครบ การระบุชื่อยังไม่ยืนยันสภาพหรือสเปก",
              "From ReBuild’s guides. Read with missing supplies; an identified name does not confirm condition or specifications.",
            )}
          </p>
        </div>
      </div>
      {uncovered.length > 0 && (
        <p className="notice">
          {t(
            "ยังไม่มีคู่มือที่ตรงกับประเภทของ: ",
            "No catalogue guide matches the type of: ",
          )}
          {uncovered.map((i) => i.label).join(", ")}
          {t(
            " — บันทึกไว้ก่อนได้ หากระบุประเภทผิดให้แก้ประเภทเพื่อเทียบใหม่",
            " — you can still save them. Correct the type if needed to match again.",
          )}
        </p>
      )}
      {openInNewTab && matches.length > 0 && (
        <p className="form-hint">
          {t(
            "คู่มือเปิดในแท็บใหม่ รายการที่กำลังตรวจยังอยู่ในหน้านี้",
            "Guides open in a new tab so your unsaved suggestions stay here.",
          )}
        </p>
      )}
      <div className="material-project-list">
        {matches.slice(0, showAll ? matches.length : 4).map((match) => {
          const p = localizeProject(match.project, language);
          const label = (id: string) =>
            p.requirements.find((r) => r.id === id)?.label ?? id;
          const missing = match.requirements.filter(
            (r) => r.status === "missing" || r.status === "short",
          );
          const checks = match.requirements.filter(
            (r) => r.status === "unknown" || r.status === "incompatible",
          );
          return (
            <article className="material-project-card" key={p.id}>
              <h4>{p.title}</h4>
              <p>
                {t("ใช้ของนี้ใน: ", "Uses this material for: ")}
                {match.relatedRequirements.map((r) => label(r.id)).join(", ")}
              </p>
              <p className="project-readiness">
                {t(
                  `มีครบตามข้อมูล ${match.fulfilled}/${match.requirements.length} รายการ`,
                  `${match.fulfilled}/${match.requirements.length} requirements covered by checked inventory`,
                )}
              </p>
              {missing.length > 0 && (
                <div className="project-missing">
                  <strong>
                    {t("ยังขาด / จำนวนไม่พอ", "Missing / not enough")}
                  </strong>
                  <ul>
                    {missing.map((r) => (
                      <li key={r.requirement.id}>
                        {label(r.requirement.id)} —{" "}
                        {t(`ขาด ${r.missing}`, `need ${r.missing}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {checks.length > 0 && (
                <div className="project-checks">
                  <strong>
                    {t("ต้องตรวจข้อมูลก่อนใช้", "Check before use")}
                  </strong>
                  <ul>
                    {checks.map((r) => {
                      const choices = r.requirement.choices.filter(
                        (c) => Object.keys(c.specs ?? {}).length > 0,
                      );
                      return (
                        <li key={r.requirement.id}>
                          {label(r.requirement.id)} —{" "}
                          {r.status === "incompatible"
                            ? t(
                                "ชนิด สภาพ หรือสเปกไม่ตรง",
                                "type, condition or specifications do not match",
                              )
                            : t(
                                "ยืนยันชนิด จำนวน และสภาพ",
                                "confirm type, quantity and condition",
                              )}
                          {choices.map((choice) => (
                            <div
                              key={choice.materialId}
                              className="spec-check-group"
                            >
                              <strong>
                                {t(
                                  materialById[choice.materialId].name,
                                  materialById[choice.materialId].en,
                                )}
                              </strong>
                              {Object.entries(choice.specs ?? {}).map(
                                ([key, values]) => (
                                  <div key={key}>
                                    {t(
                                      materialById[choice.materialId].specs[key]
                                        ?.label ?? key,
                                      specNames[key] ?? key,
                                    )}
                                    :{" "}
                                    {values
                                      .map((v) =>
                                        v === "yes"
                                          ? t("ใช่", "yes")
                                          : v === "no"
                                            ? t("ไม่", "no")
                                            : v,
                                      )
                                      .join(t(" หรือ ", " or "))}
                                  </div>
                                ),
                              )}
                            </div>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <a
                className="text-link"
                href={`#/project/${p.id}`}
                target={openInNewTab ? "_blank" : undefined}
                rel={openInNewTab ? "noopener" : undefined}
              >
                {t("อ่านคู่มือ", "Read guide")} <ArrowUpRight size={16} />
              </a>
            </article>
          );
        })}
      </div>
      {!showAll && matches.length > 4 && (
        <button className="secondary" onClick={() => setShowAll(true)}>
          {t(
            `ดูทั้งหมด ${matches.length} โปรเจกต์`,
            `Show all ${matches.length} projects`,
          )}
        </button>
      )}
      <div className="web-search-entry">
        <div>
          <strong>
            {t("ค้นหาโปรเจกต์นอก ReBuild", "Find projects beyond ReBuild")}
          </strong>
          <p>
            {openInNewTab
              ? t(
                  "บันทึกของที่ตรวจแล้วลงคลังก่อน จากนั้นเลือกวัสดุเพื่อค้นอินเทอร์เน็ต",
                  "Save the reviewed items first, then select them for a web search.",
                )
              : t(
                  "เลือกวัสดุจากคลังเพื่อค้นหาคู่มือและวิดีโอจากอินเทอร์เน็ต",
                  "Choose inventory materials to search for tutorials and videos on the web.",
                )}
          </p>
        </div>
        <a
          className="secondary"
          href="#/web-projects"
          target={openInNewTab ? "_blank" : undefined}
          rel={openInNewTab ? "noopener" : undefined}
        >
          {t("ค้นหาจากอินเทอร์เน็ต", "Search the web")}{" "}
          <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  );
}
