import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Camera,
  Package,
  Compass,
  Hammer,
  Leaf,
  Clock,
  Upload,
  Download,
  Trash2,
  Pencil,
  Search,
  CheckCircle2,
  X,
  RotateCcw,
  BookOpen,
  Globe2,
  SlidersHorizontal,
} from "lucide-react";
import {
  projects,
  projectById,
  localizeProject,
  categories,
} from "./data/projects";
import { materials, materialById } from "./data/materials";
import {
  emptyState,
  importState,
  downloadState,
  mergeConfirmed,
} from "./domain/inventory";
import { matchProject } from "./domain/matching";
import {
  featuredIds,
  searchProjects,
  searchMaterials,
} from "./domain/catalogue";
import type {
  InventoryItem,
  SavedState,
  Project,
  Progress,
} from "./domain/schema";
import { ProjectArt } from "./components/Art";
import { ItemEditor, AddModal, type EditorSeed } from "./components/Inventory";
import { ProjectGuide } from "./components/Guide";
import { useLanguage, unitText } from "./i18n";
const STORE = "rebuild.guest.v1";
function readLocal() {
  try {
    const raw = localStorage.getItem(STORE);
    return {
      state: raw ? importState(raw) : structuredClone(emptyState),
      error: false,
    };
  } catch {
    return { state: structuredClone(emptyState), error: true };
  }
}
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const fn = () => {
      setRoute(location.hash.slice(1) || "/");
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return route;
}
const go = (path: string) => {
  location.hash = path;
};
export default function App() {
  const { t, language, setLanguage } = useLanguage();
  const [initial] = useState(readLocal);
  const [state, setState] = useState<SavedState>(initial.state);
  const [paused, setPaused] = useState(initial.error),
    [storageError, setStorageError] = useState(initial.error);
  const [health, setHealth] = useState("checking"),
    [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<EditorSeed | null>(null),
    [addMode, setAddMode] = useState<"bulk" | "photo" | null>(null);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [quick, setQuick] = useState(false),
    [readyOnly, setReadyOnly] = useState(false);
  const [catalogueQuery, setCatalogueQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  useEffect(() => {
    setVisibleCount(12);
  }, [query, category, quick, readyOnly]);
  const importRef = useRef<HTMLInputElement>(null);
  const route = useRoute();
  const p =
    route.startsWith("/project/") || route.startsWith("/build/")
      ? projectById[route.split("/")[2]]
      : undefined;
  const inventory = state.inventory;
  useEffect(() => {
    if (paused) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state, paused]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((h) => setHealth(h.aiConfigured ? "online" : "offline"))
      .catch((e) => {
        if (e.name !== "AbortError") setHealth("error");
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const saveItem = (item: InventoryItem) => {
    if (inventory.length >= 500 && !inventory.some((i) => i.id === item.id)) {
      setNotice(
        t(
          "คลังเต็ม 500 รายการ ส่งออกแล้วลบบางรายการก่อน",
          "Your 500-item inventory is full. Export a backup and remove some items first.",
        ),
      );
      return;
    }
    setState((s) => ({
      ...s,
      inventory: s.inventory.some((i) => i.id === item.id)
        ? s.inventory.map((i) => (i.id === item.id ? item : i))
        : [...s.inventory, item],
    }));
    setEditor(null);
    setNotice(t("บันทึกของแล้ว", "Item saved."));
  };
  const addCandidates = (items: InventoryItem[]) => {
    if (inventory.length + items.length > 500) {
      setNotice(
        t(
          "รายการรวมเกิน 500 กรุณาลดจำนวนก่อนเพิ่ม",
          "This would exceed 500 items. Add fewer items.",
        ),
      );
      return;
    }
    setState((s) => ({ ...s, inventory: [...s.inventory, ...items] }));
    setAddMode(null);
    go("/inventory");
    setNotice(
      t(
        "บันทึกแล้ว ตรวจรายละเอียดเมื่อสะดวก อ่านคู่มือได้เสมอ",
        "Saved. Review the details when you’re ready; all guides remain available.",
      ),
    );
  };
  const saveBuild = (id: string) => {
    if (
      !state.builds.some((b) => b.projectId === id) &&
      state.builds.length >= 100
    ) {
      setNotice(
        t(
          "บันทึกได้สูงสุด 100 งาน ส่งออกแล้วลบบางงานก่อน",
          "You can save 100 builds. Export and remove a build first.",
        ),
      );
      return;
    }
    setState((s) =>
      s.builds.some((b) => b.projectId === id)
        ? s
        : {
            ...s,
            builds: [
              ...s.builds,
              {
                projectId: id,
                completed: [],
                notes: "",
                measurements: [],
                substitutions: {},
                updatedAt: new Date().toISOString(),
              },
            ],
          },
    );
    go(`/build/${id}`);
  };
  const updateBuild = (next: Progress) =>
    setState((s) => ({
      ...s,
      builds: s.builds.map((b) =>
        b.projectId === next.projectId
          ? { ...next, updatedAt: new Date().toISOString() }
          : b,
      ),
    }));
  async function onImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error();
      const next = importState(await file.text());
      if (
        !confirm(
          t(
            "แทนที่คลังและงานที่บันทึกในเบราว์เซอร์นี้? ส่งออกข้อมูลเดิมก่อนถ้าต้องการเก็บไว้",
            "Replace this browser’s inventory and saved builds? Export your existing data first if you want to keep it.",
          ),
        )
      )
        return;
      setPaused(false);
      setState(next);
      setNotice(t("นำเข้าสำเร็จ", "Backup imported."));
    } catch {
      setNotice(
        t(
          "นำเข้าไม่ได้ ใช้ไฟล์สำรอง ReBuild รุ่น 1 ที่ถูกต้อง ขนาดไม่เกิน 2 MB",
          "Import failed. Choose a valid ReBuild version 1 backup under 2 MB.",
        ),
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  const browse = (id: string) => {
    setCategory(id);
    setQuery("");
    setReadyOnly(false);
    setQuick(false);
    go("/explore");
  };
  const filtered = searchProjects(query).filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (!quick || p.minutes <= 20) &&
      (!readyOnly || matchProject(p, inventory).state === "ready"),
  );
  const nav = [
    { path: "/explore", label: t("หาโปรเจกต์", "Explore"), icon: Compass },
    { path: "/inventory", label: t("ของที่มี", "My materials"), icon: Package },
    { path: "/builds", label: t("งานที่บันทึก", "Saved builds"), icon: Hammer },
  ];
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        {t("ข้ามไปเนื้อหา", "Skip to content")}
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="#/"
          aria-label={t("ReBuild หน้าหลัก", "ReBuild home")}
        >
          <span className="brand-mark">
            <RotateCcw size={22} />
          </span>
          ReBuild<span className="brand-dot">.</span>
        </a>
        <nav className="nav" aria-label={t("เมนูหลัก", "Main navigation")}>
          {nav.map(({ path, label, icon: Icon }) => (
            <a
              key={path}
              href={`#${path}`}
              className={
                route === path ||
                (path === "/explore" && route.startsWith("/project/"))
                  ? "active"
                  : ""
              }
              aria-current={route === path ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <button
          className="language-button"
          onClick={() => setLanguage(language === "th" ? "en" : "th")}
          aria-label={
            language === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"
          }
        >
          <Globe2 size={17} />
          {language === "th" ? "English" : "ไทย"}
        </button>
      </header>
      <main id="main" tabIndex={-1}>
        {storageError && (
          <div className="notice error" role="alert">
            <div>
              {paused
                ? t(
                    "อ่านข้อมูลที่บันทึกไว้ไม่ได้ ข้อมูลเดิมยังอยู่ ดาวน์โหลดสำรองก่อนเริ่มใหม่",
                    "Could not read saved data. Your original data is preserved. Download it before starting over.",
                  )
                : t(
                    "บันทึกในเบราว์เซอร์ไม่ได้ กรุณาส่งออกก่อนปิดหน้านี้",
                    "Browser storage is unavailable. Export your data before closing this page.",
                  )}
            </div>
            <button
              className="secondary"
              onClick={() => {
                const raw = localStorage.getItem(STORE);
                if (raw) {
                  const url = URL.createObjectURL(
                    new Blob([raw], { type: "text/plain" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "rebuild-recovery.txt";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
              }}
            >
              {t("ดาวน์โหลดข้อมูลเดิม", "Download original data")}
            </button>
            <button
              className="text-link"
              onClick={() => {
                if (
                  confirm(
                    t(
                      "ลบข้อมูลเดิมแล้วเริ่มใหม่?",
                      "Replace existing data and start over?",
                    ),
                  )
                ) {
                  setPaused(false);
                  setState(structuredClone(emptyState));
                }
              }}
            >
              {t("เริ่มใหม่", "Start over")}
            </button>
          </div>
        )}
        {route === "/" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="tiny-leaf">
                    <Leaf size={14} />
                  </span>
                  {t(
                    "ของใกล้ตัว ใช้ประโยชน์ได้อีก",
                    "A SECOND LIFE FOR EVERYDAY THINGS",
                  )}
                </div>
                <h1>
                  {t("ของที่มีในบ้าน", "Everyday things.")}
                  <br />
                  <span>{t("ทำอะไรได้อีก?", "Made useful again.")}</span>
                </h1>
                <p className="hero-description">
                  {t(
                    "เลือกไอเดียที่ใช้ได้จริง แล้วทำตามทีละขั้น จัดบ้าน ปลูกต้นไม้ ซ่อมของ และเรียนรู้ไปด้วยกัน",
                    "Make something you’ll actually use. Simple projects for a tidier home, a little garden, and a curious mind.",
                  )}
                </p>
                <a href="#/explore" className="primary large">
                  {t("เลือกโปรเจกต์ที่อยากทำ", "Find something to make")}
                  <ArrowRight size={19} />
                </a>
                <p className="hero-footnote">
                  <CheckCircle2 size={16} />
                  {t(
                    "อ่านได้ทุกขั้น ไม่ต้องมีของครบ ไม่ต้องสมัคร",
                    "Every step is open. No materials or account needed.",
                  )}
                </p>
              </div>
              <div className="hero-visual">
                <ProjectArt kind="planter" hero />
                <span className="hero-sticker">
                  <Leaf size={17} />
                  {t("ขวดเก่า → กระถางใหม่", "Old bottle → new planter")}
                </span>
                <a href="#/project/bottle-planter" className="hero-caption">
                  <div>
                    <span>
                      {t("ลองทำสุดสัปดาห์นี้", "YOUR WEEKEND PROJECT")}
                    </span>
                    <strong>
                      {t("กระถางให้น้ำด้วยเชือก", "A bottle wick planter")}
                    </strong>
                  </div>
                  <span className="round-arrow">
                    <ArrowUpRight />
                  </span>
                </a>
              </div>
            </section>
            <div className="process-strip">
              {[
                [
                  "01",
                  t("เลือกสิ่งที่อยากทำ", "Find your project"),
                  t(
                    "เริ่มจากประโยชน์ที่อยากได้",
                    "Start with something useful",
                  ),
                ],
                [
                  "02",
                  t("ดูของและอ่านวิธีทำ", "Read the simple steps"),
                  t(
                    "ของยังไม่ครบ ก็อ่านก่อนได้",
                    "Look around, even with no materials",
                  ),
                ],
                [
                  "03",
                  t("ลองทำในแบบของคุณ", "Make it, learn from it"),
                  t(
                    "บันทึกความคืบหน้าเมื่อพร้อม",
                    "Save your progress when you’re ready",
                  ),
                ],
              ].map(([n, title, text]) => (
                <div key={n}>
                  <span className="step-number">{n}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <section className="section">
              <SectionHeading
                eyebrow={t("เริ่มจากเรื่องใกล้ตัว", "A LITTLE INSPIRATION")}
                title={t("วันนี้อยากทำอะไร?", "What would you like to make?")}
                subtitle={t(
                  "เลือกตามการใช้งาน ไม่ต้องเริ่มจากการกรอกของ",
                  "Choose by what you need. Your inventory can wait.",
                )}
              />
              <div className="category-grid">
                {categories.slice(1).map((c) => (
                  <button
                    key={c.id}
                    className={`category-card category-${c.id}`}
                    onClick={() => browse(c.id)}
                  >
                    <span aria-hidden="true">{c.symbol}</span>
                    <strong>{t(c.th, c.en)}</strong>
                    <small>
                      {projects.filter((p) => p.category === c.id).length}{" "}
                      {t("ไอเดีย", "ideas")}
                    </small>
                  </button>
                ))}
              </div>
            </section>
            <section className="section">
              <SectionHeading
                eyebrow={t(
                  "ทำง่าย ใช้ได้ทุกวัน",
                  "SMALL PROJECTS. REAL PURPOSE.",
                )}
                title={t("ของเดิม ประโยชน์ใหม่", "A good place to start")}
                subtitle={t(
                  "ไอเดียจากกล่อง ขวด และเสื้อผ้าที่คุณอาจมีอยู่แล้ว",
                  "Good things to make with boxes, bottles and clothes you already have.",
                )}
                action={
                  <a className="text-link" href="#/explore">
                    {t(
                      `ดูทั้งหมด ${projects.length} โปรเจกต์`,
                      `All ${projects.length} projects`,
                    )}
                    <ArrowRight size={17} />
                  </a>
                }
              />
              <div className="project-grid">
                {featuredIds.map((id) => (
                  <ProjectCard
                    key={id}
                    project={projectById[id]}
                    inventory={inventory}
                  />
                ))}
              </div>
            </section>
            <section className="invitation">
              <div className="invitation-symbol">
                <Package size={37} />
              </div>
              <div>
                <h2>
                  {t(
                    "เริ่มจากของที่เก็บไว้ก็ได้",
                    "Already have something in mind?",
                  )}
                </h2>
                <p>
                  {t(
                    `สำรวจของในบ้าน ${materials.length} ชนิด แล้วดูว่าใช้ทำอะไรได้บ้าง`,
                    `Explore ${materials.length} material types and discover what they can become.`,
                  )}
                </p>
              </div>
              <a className="secondary" href="#/materials">
                {t("ดูวัสดุในบ้าน", "Explore household materials")}
                <ArrowRight size={18} />
              </a>
            </section>
          </>
        )}
        {route === "/explore" && (
          <>
            <PageHeading
              eyebrow={t(
                "เลือกก่อน แล้วค่อยเตรียมของ",
                "FIND YOUR NEXT LITTLE PROJECT",
              )}
              title={t(
                "อยากทำอะไรที่ใช้ได้จริง?",
                "Something useful starts here.",
              )}
              description={t(
                "เปิดอ่านได้ทุกโปรเจกต์ แม้ยังไม่มีวัสดุ เลือกสิ่งที่สนใจแล้วเริ่มเรียนรู้",
                "Browse every guide, even with an empty inventory. Pick an idea and see how it’s made.",
              )}
            />
            <label className="search-field catalogue-search">
              <Search size={21} />
              <input
                aria-label={t("ค้นหาโปรเจกต์ที่อยากทำ", "Search projects")}
                placeholder={t(
                  "ค้นหาไอเดียหรือวัสดุ เช่น กระถาง กล่อง เสื้อยืด",
                  "Search an idea or material: planter, cardboard, T-shirt…",
                )}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  onClick={() => setQuery("")}
                  aria-label={t("ล้างการค้นหา", "Clear search")}
                >
                  <X size={18} />
                </button>
              )}
            </label>
            <div
              className="category-pills"
              aria-label={t("หมวดหมู่โปรเจกต์", "Project categories")}
            >
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={category === c.id ? "selected" : ""}
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                >
                  {t(c.th, c.en)}
                </button>
              ))}
            </div>
            <div className="results-toolbar">
              <span>
                {filtered.length} {t("โปรเจกต์ให้ลองทำ", "projects to explore")}
              </span>
              <div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={quick}
                    onChange={(e) => setQuick(e.target.checked)}
                  />
                  {t("ไม่เกิน 20 นาที", "20 minutes or less")}
                </label>
                <details className="filter-menu">
                  <summary>
                    <SlidersHorizontal size={16} />
                    {t("ตัวกรองเพิ่ม", "More filters")}
                  </summary>
                  <div className="filter-popover">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={readyOnly}
                        onChange={(e) => setReadyOnly(e.target.checked)}
                      />
                      {t(
                        "มีของที่ตรวจแล้วครบ",
                        "Only with all checked materials",
                      )}
                    </label>
                    <p>
                      {t(
                        "ตัวเลือกนี้ใช้ข้อมูลจากของที่มี และอาจซ่อนโปรเจกต์",
                        "Uses your inventory and may hide projects.",
                      )}
                    </p>
                  </div>
                </details>
              </div>
            </div>
            {filtered.length ? (
              <>
                <div className="project-grid catalogue-grid">
                  {filtered.slice(0, visibleCount).map((p) => (
                    <ProjectCard key={p.id} project={p} inventory={inventory} />
                  ))}
                </div>
                {filtered.length > visibleCount && (
                  <div className="load-more">
                    <p>
                      {t(
                        `แสดง ${visibleCount} จาก ${filtered.length} โปรเจกต์`,
                        `Showing ${visibleCount} of ${filtered.length} projects`,
                      )}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => setVisibleCount((n) => n + 12)}
                    >
                      {t("ดูโปรเจกต์เพิ่ม", "Show more projects")}
                      <Plus size={17} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Empty
                icon={<Compass size={36} />}
                title={t(
                  "ยังไม่พบโปรเจกต์ที่ตรงเงื่อนไข",
                  "No projects match yet",
                )}
                text={t(
                  "ลองชื่อวัสดุอื่น หรือเปิดดูทุกโปรเจกต์อีกครั้ง",
                  "Try another material or clear the filters to browse everything.",
                )}
              >
                <button
                  className="primary"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                    setReadyOnly(false);
                    setQuick(false);
                  }}
                >
                  {t("ล้างตัวกรอง", "Clear filters")}
                </button>
              </Empty>
            )}
          </>
        )}
        {route === "/inventory" && (
          <>
            <PageHeading
              eyebrow={t(
                "ทำเมื่อสะดวก ไม่จำเป็นต้องกรอกก่อน",
                "OPTIONAL, AND ALWAYS YOURS",
              )}
              title={t("ของที่มีในบ้าน", "My materials")}
              description={t(
                "บันทึกของเพื่อช่วยเช็กรายการ อ่านคู่มือได้โดยไม่ต้องกรอกคลังให้ครบ",
                "Keep a list to make material checks easier. You can read every guide without filling this in.",
              )}
              action={
                <button className="primary" onClick={() => setEditor({})}>
                  <Plus size={18} />
                  {t("เพิ่มของที่มี", "Add an item")}
                </button>
              }
            />
            <div className="inventory-layout">
              <section>
                <div className="quick-actions">
                  <button
                    className="secondary"
                    onClick={() => setAddMode("bulk")}
                  >
                    <Pencil size={18} />
                    {t("พิมพ์หลายรายการ", "Add a list")}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setAddMode("photo")}
                  >
                    <Camera size={18} />
                    {t("เพิ่มจากรูปภาพ", "Use a photo")}
                  </button>
                  <a className="text-link" href="#/materials">
                    {t("ดูของที่รองรับ", "Explore materials")}
                    <ArrowUpRight size={16} />
                  </a>
                </div>
                {!inventory.length ? (
                  <Empty
                    icon={<Package size={42} />}
                    title={t(
                      "กล่อง ขวด หรือเสื้อยืดตัวเก่า?",
                      "A box, a bottle, an old T-shirt?",
                    )}
                    text={t(
                      "เริ่มจากของสักชิ้น หรือข้ามไปหาไอเดียก่อนได้",
                      "Add your first item, or browse ideas first.",
                    )}
                  >
                    <button className="primary" onClick={() => setEditor({})}>
                      {t("เพิ่มชิ้นแรก", "Add my first item")}
                      <Plus size={17} />
                    </button>
                    <a className="text-link" href="#/explore">
                      {t("ขอดูโปรเจกต์ก่อน", "Just let me explore")}
                      <ArrowRight size={16} />
                    </a>
                  </Empty>
                ) : (
                  <div className="inventory-list">
                    {inventory.map((item) => (
                      <article className="inventory-row" key={item.id}>
                        <span className="item-icon">
                          <Package size={22} />
                        </span>
                        <div className="item-info">
                          <strong>{item.label}</strong>
                          <span>
                            {language === "th"
                              ? materialById[item.materialId]?.name
                              : materialById[item.materialId]?.en}{" "}
                            · {item.quantity} {unitText(item.unit, language)}
                          </span>
                          <small>
                            {item.condition === "damaged"
                              ? t(
                                  "ชำรุด — ไม่นับว่าพร้อมใช้",
                                  "Damaged — excluded from readiness",
                                )
                              : item.verified && item.condition === "usable"
                                ? t(
                                    "บันทึกตามข้อมูลที่คุณตรวจแล้ว",
                                    "Your checked details",
                                  )
                                : t(
                                    "ยังไม่ตรวจรายละเอียด · ไม่ขัดขวางการอ่านคู่มือ",
                                    "Details to review · guides stay open",
                                  )}
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`${t("แก้ไข", "Edit")} ${item.label}`}
                          onClick={() => setEditor({ item })}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`${t("ลบ", "Delete")} ${item.label}`}
                          onClick={() => {
                            if (
                              confirm(
                                t(
                                  `ลบ ${item.label} ออกจากคลัง?`,
                                  `Remove ${item.label} from your inventory?`,
                                ),
                              )
                            )
                              setState((s) => ({
                                ...s,
                                inventory: s.inventory.filter(
                                  (i) => i.id !== item.id,
                                ),
                              }));
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <aside>
                <div className="panel green-panel">
                  <div className="eyebrow">
                    {t("หาไอเดียต่อได้เลย", "YOUR NEXT IDEA")}
                  </div>
                  <h2>{t("ไม่ต้องมีของครบ", "You don’t need everything.")}</h2>
                  <p>
                    {t(
                      "บันทึกเฉพาะที่รู้ ส่วนที่ขาดค่อยดูทางเลือกในแต่ละคู่มือ",
                      "Save what you know. Each guide shows its requirements and available alternatives.",
                    )}
                  </p>
                  <a href="#/explore" className="primary">
                    {t("เลือกโปรเจกต์", "Explore projects")}
                    <ArrowRight size={17} />
                  </a>
                </div>
                <details className="panel data-panel">
                  <summary>
                    {t(
                      "สำรองข้อมูลและจัดการคลัง",
                      "Backups & inventory settings",
                    )}
                  </summary>
                  <p>
                    {t(
                      "ข้อมูลอยู่ในเบราว์เซอร์นี้ ส่งออกก่อนล้างข้อมูลหรือเปลี่ยนเครื่อง",
                      "Your data stays in this browser. Export before clearing storage or changing devices.",
                    )}
                  </p>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() => downloadState(state)}
                    >
                      <Download size={16} />
                      {t("ส่งออก", "Export")}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={16} />
                      {t("นำเข้า", "Import")}
                    </button>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => {
                      if (
                        confirm(
                          t(
                            "รวมรายการที่มีชื่อ สเปก และสถานะตรงกันโดยบวกจำนวน? ตรวจว่าไม่ใช่ของชิ้นเดียวกันก่อน",
                            "Merge identical names, specifications and status by adding quantities? First check these are separate objects.",
                          ),
                        )
                      )
                        setState((s) => ({
                          ...s,
                          inventory: mergeConfirmed(s.inventory),
                        }));
                    }}
                  >
                    {t("รวมรายการซ้ำที่ตรวจแล้ว", "Merge identical entries")}
                  </button>
                  <button
                    className="text-link danger"
                    onClick={() => {
                      if (
                        confirm(
                          t(
                            "ลบคลังและงานที่บันทึกทั้งหมด? ย้อนกลับไม่ได้หากไม่มีไฟล์สำรอง",
                            "Delete all inventory and saved builds? You need a backup to restore them.",
                          ),
                        )
                      ) {
                        setState(structuredClone(emptyState));
                        setPaused(false);
                      }
                    }}
                  >
                    {t("ล้างข้อมูลทั้งหมด", "Clear all data")}
                  </button>
                </details>
              </aside>
            </div>
          </>
        )}
        {p && (
          <ProjectGuide
            key={`${p.id}-${route.startsWith("/build/")}`}
            project={p}
            inventory={inventory}
            progress={
              route.startsWith("/build/")
                ? state.builds.find((b) => b.projectId === p.id)
                : undefined
            }
            hasBuild={state.builds.some((b) => b.projectId === p.id)}
            start={() => saveBuild(p.id)}
            update={updateBuild}
            addMaterial={(materialId) => setEditor({ materialId })}
            health={health}
          />
        )}
        {route === "/builds" && (
          <>
            <PageHeading
              eyebrow={t("พื้นที่สำหรับไอเดียของคุณ", "A PLACE FOR YOUR IDEAS")}
              title={t("งานที่บันทึก", "Saved builds")}
              description={t(
                "เก็บไอเดีย ติดตามขั้นตอน และจดสิ่งที่ได้เรียนรู้บนเบราว์เซอร์นี้",
                "Keep ideas, track steps and record what you learn in this browser.",
              )}
            />
            {state.builds.length ? (
              <div className="project-grid">
                {state.builds.map((b) => {
                  const p = localizeProject(projectById[b.projectId], language);
                  return (
                    <article className="project-card" key={b.projectId}>
                      <a
                        href={`#/build/${p.id}`}
                        className="card-art-link"
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <ProjectArt kind={p.icon} />
                      </a>
                      <div className="card-content">
                        <div className="card-meta">
                          <span>
                            {b.completed.length} / {p.steps.length}{" "}
                            {t("ขั้นตอน", "steps")}
                          </span>
                          <button
                            className="icon-button danger"
                            aria-label={`${t("ลบงาน", "Delete build")} ${p.title}`}
                            onClick={() => {
                              if (
                                confirm(
                                  t(
                                    "ลบงานและบันทึกนี้?",
                                    "Delete this build and its notes?",
                                  ),
                                )
                              )
                                setState((s) => ({
                                  ...s,
                                  builds: s.builds.filter(
                                    (x) => x.projectId !== p.id,
                                  ),
                                }));
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <h2>
                          <a href={`#/build/${p.id}`}>{p.title}</a>
                        </h2>
                        <div className="progress-track">
                          <span
                            style={{
                              width: `${(b.completed.length / p.steps.length) * 100}%`,
                            }}
                          />
                        </div>
                        <a className="text-link" href={`#/build/${p.id}`}>
                          {t("ทำต่อ", "Continue")}
                          <ArrowRight size={16} />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty
                icon={<Hammer size={42} />}
                title={t(
                  "เก็บไอเดียแรกไว้ที่นี่",
                  "Your next project belongs here",
                )}
                text={t(
                  "เลือกโปรเจกต์แล้วกดบันทึกเมื่ออยากติดตามความคืบหน้า",
                  "Open a guide and save a build whenever you want to track progress.",
                )}
              >
                <a className="primary" href="#/explore">
                  {t("หาโปรเจกต์", "Explore projects")}
                  <ArrowRight size={17} />
                </a>
              </Empty>
            )}
          </>
        )}
        {route === "/materials" && (
          <>
            <PageHeading
              eyebrow={t(
                "มองของเดิมในมุมใหม่",
                "LOOK AROUND. THERE’S POTENTIAL.",
              )}
              title={t("ของในบ้าน ทำอะไรได้บ้าง", "Household materials")}
              description={t(
                "ค้นหาจากชื่อไทยหรืออังกฤษ กดดูไอเดียที่ใช้ของชิ้นนั้น หรือเพิ่มของอื่นในคลังได้",
                "Search in Thai or English. Find a matching guide or add your own item to the inventory.",
              )}
            />
            <label className="search-field">
              <Search size={20} />
              <input
                aria-label={t("ค้นหาวัสดุ", "Search materials")}
                placeholder={t(
                  "ขวด กล่อง เสื้อยืด ไม้…",
                  "Bottles, boxes, T-shirts, wood…",
                )}
                value={catalogueQuery}
                onChange={(e) => setCatalogueQuery(e.target.value)}
              />
            </label>
            <p className="results-count">
              {searchMaterials(catalogueQuery).length}{" "}
              {t("ชนิด", "material types")}
            </p>
            <div className="materials-grid">
              {searchMaterials(catalogueQuery).map((m) => {
                const linked = projects.filter((p) =>
                  p.requirements.some((r) =>
                    r.choices.some((c) => c.materialId === m.id),
                  ),
                );
                return (
                  <article className="material-card" key={m.id}>
                    <span
                      className={`material-symbol group-${m.group ?? m.kind}`}
                    >
                      <Package size={23} />
                    </span>
                    <h2>{t(m.name, m.en)}</h2>
                    <p>{t(m.en, m.name)}</p>
                    <span className="material-coverage">
                      {linked.length
                        ? t(
                            `${linked.length} โปรเจกต์`,
                            `${linked.length} projects`,
                          )
                        : t(
                            "บันทึกได้ · คู่มือยังไม่ครอบคลุม",
                            "You can save this · guides coming later",
                          )}
                    </span>
                    {linked.slice(0, 2).map((p) => (
                      <a
                        key={p.id}
                        className="catalogue-project"
                        href={`#/project/${p.id}`}
                      >
                        {localizeProject(p, language).title}
                        <ArrowUpRight size={14} />
                      </a>
                    ))}
                    <button
                      className="text-link"
                      onClick={() => setEditor({ materialId: m.id })}
                    >
                      <Plus size={16} />
                      {t("เพิ่มในของที่มี", "Add to my materials")}
                    </button>
                  </article>
                );
              })}
            </div>
            {!searchMaterials(catalogueQuery).length && (
              <Empty
                icon={<Search size={32} />}
                title={t(
                  "ยังไม่มีชื่อนี้ในรายการ",
                  "That name isn’t in the list yet",
                )}
                text={t(
                  "เพิ่มเป็นของอื่นพร้อมชื่อของคุณเองได้",
                  "You can still save it as a custom item.",
                )}
              >
                <button
                  className="primary"
                  onClick={() =>
                    setEditor({ materialId: "unknown", label: catalogueQuery })
                  }
                >
                  {t("เพิ่มของอื่น", "Add a custom item")}
                </button>
              </Empty>
            )}
          </>
        )}
        {route === "/about" && (
          <>
            <PageHeading
              eyebrow="REBUILD, TOGETHER"
              title={t(
                "ของใช้จริง และการเรียนรู้ทุกวัน",
                "Useful things. Everyday learning.",
              )}
              description={t(
                "สร้างจากของรอบตัว อ่านได้อย่างอิสระ และค่อยลงมือเมื่อพร้อม",
                "Make with what’s around you. Explore freely and build when you’re ready.",
              )}
            />
            <div className="prose panel">
              <h2>{t("เริ่มยังไง", "How to start")}</h2>
              <ol>
                <li>
                  {t(
                    "เลือกโปรเจกต์จากหมวดหรือค้นหาวัสดุ",
                    "Browse a category or search for a material.",
                  )}
                </li>
                <li>
                  {t(
                    "อ่านขั้นตอน ดูของที่ต้องใช้ และเปิดวิดีโอหรือค้นหาคลิปเพิ่มเติม",
                    "Read the steps, check the materials, and follow tutorial links or search for videos.",
                  )}
                </li>
                <li>
                  {t(
                    "บันทึกงานเมื่อต้องการจดความคืบหน้า ไม่ต้องยืนยันคลังก่อน",
                    "Save a build to track progress. Inventory confirmation is not required.",
                  )}
                </li>
              </ol>
              <h2>{t("คู่มือและความพร้อม", "Guides and material checks")}</h2>
              <p>
                {t(
                  `มี ${projects.length} คู่มือ: 21 คู่มือของใช้ในบ้านที่เขียนขึ้นสำหรับ ReBuild และ 16 คู่มือจากเอกสาร Arduino/NASA ยังไม่ได้ทดสอบชิ้นงานจริง เวลาที่ระบุเป็นการประมาณ`,
                  `There are ${projects.length} guides: 21 original ReBuild household projects and 16 adapted from Arduino/NASA documentation. Physical builds have not been tested; time estimates are editorial.`,
                )}
              </p>
              <p>
                {t(
                  "รูปเป็นภาพประกอบแนวคิด ใช้ขนาด สเปก และขั้นตอนที่เขียนเป็นหลัก สถานะวัสดุเป็นข้อมูลช่วยวางแผน ไม่ใช่ใบรับรองความปลอดภัย",
                  "Illustrations show the idea; follow written dimensions, specifications and instructions. Inventory status helps planning and is not a safety certification.",
                )}
              </p>
              <h2>{t("ข้อมูลของคุณ", "Your data")}</h2>
              <p>
                {t(
                  "คลัง งาน และบันทึกอยู่ใน localStorage ของเบราว์เซอร์นี้ ไม่มีบัญชีหรือซิงก์ข้ามเครื่อง ส่งออกหรือลบได้จากของที่มี → สำรองข้อมูลและจัดการคลัง",
                  "Inventory, builds and notes live in this browser’s localStorage. There is no account or cross-device sync. Export or delete them under My materials → Backups & inventory settings.",
                )}
              </p>
              <h2>{t("รูปและผู้ช่วย AI", "Photos and the AI helper")}</h2>
              <p>
                {t(
                  "AI เป็นทางเลือก เมื่อใช้ ข้อความ รูปที่คุณยินยอมส่ง คลัง และบริบทคู่มือจะส่งให้ OpenAI รูปไม่บันทึกบนเซิร์ฟเวอร์ของแอป เงื่อนไขการเก็บข้อมูลของผู้ให้บริการแยกจากแอป การลบข้อมูลในเบราว์เซอร์ไม่ได้ลบข้อมูลที่ส่งไปแล้ว",
                  "AI is optional. When used, your text, consented photos, inventory and guide context go to OpenAI. The app does not store photos on its server. Provider retention terms are separate; clearing browser data does not delete information already sent to the provider.",
                )}
              </p>
              <p>
                {t(
                  "เซิร์ฟเวอร์ใช้คุกกี้เซสชัน HttpOnly และแฮช IP เพื่อจำกัดการใช้ ไม่บันทึกรูปหรือข้อความลง log ข้อเสนอ AI ต้องตรวจเอง ไม่ใช้อนุมัติชิ้นส่วนทดแทน",
                  "The server uses an HttpOnly session cookie and hashed IP counters for usage limits. It does not log photos or prompts. Review AI suggestions yourself; they do not approve substitutions.",
                )}
              </p>
              <h2>{t("ดูวิดีโอเพิ่มเติม", "Tutorial links")}</h2>
              <p>
                {t(
                  "ลิงก์ NASA มาจากหน้าคู่มือทางการ ปุ่มค้นหา YouTube เปิดผลค้นหา ไม่ใช่คลิปที่เราคัดและดูครบแล้ว เปรียบเทียบวัสดุและวิธีทำกับคู่มือนี้ก่อนลอง",
                  "The NASA video link comes from its official guide. YouTube search buttons open search results, not individually reviewed videos. Compare materials and methods with this guide before trying them.",
                )}
              </p>
            </div>
          </>
        )}
        {![
          "/",
          "/explore",
          "/inventory",
          "/builds",
          "/materials",
          "/about",
        ].includes(route) &&
          !p && (
            <Empty
              icon={<Compass size={36} />}
              title={t("ไม่พบหน้านี้", "Page not found")}
              text={t(
                "ลองเลือกโปรเจกต์ใหม่จากรายการ",
                "Choose another project from the catalogue.",
              )}
            >
              <a className="primary" href="#/explore">
                {t("ดูโปรเจกต์", "Explore projects")}
              </a>
            </Empty>
          )}
      </main>
      <footer>
        <div>
          <a className="brand" href="#/">
            ReBuild<span className="brand-dot">.</span>
          </a>
          <p>
            {t(
              "ของเดิม ประโยชน์ใหม่ เรียนรู้ได้ทุกวัน",
              "Make a little. Learn a lot.",
            )}
          </p>
        </div>
        <nav aria-label={t("ข้อมูลเพิ่มเติม", "More information")}>
          <a href="#/materials">{t("วัสดุในบ้าน", "Household materials")}</a>
          <a href="#/about">
            {t("วิธีใช้และความเป็นส่วนตัว", "How it works & privacy")}
          </a>
        </nav>
        <span className="service-status">
          {health === "online"
            ? t("ตั้งค่า AI แล้ว", "AI configured")
            : health === "checking"
              ? t("กำลังตรวจบริการ", "Checking service")
              : t(
                  "คู่มือและคลังใช้ได้โดยไม่ต้องมี AI",
                  "Guides and inventory work without AI",
                )}
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label={t("ปิดข้อความ", "Dismiss message")}
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {editor && (
        <ItemEditor
          seed={editor}
          close={() => setEditor(null)}
          save={saveItem}
        />
      )}
      {addMode && (
        <AddModal
          mode={addMode}
          health={health}
          inventory={inventory}
          close={() => setAddMode(null)}
          add={addCandidates}
        />
      )}
      <input
        type="file"
        ref={importRef}
        hidden
        accept="application/json,.json"
        aria-label={t("ไฟล์นำเข้าคลัง", "Inventory backup file")}
        onChange={(e) => void onImport(e.target.files?.[0])}
      />
    </>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
function ProjectCard({
  project,
  inventory,
}: {
  project: Project;
  inventory: InventoryItem[];
}) {
  const { t, language } = useLanguage();
  const p = localizeProject(project, language);
  const category = categories.find((c) => c.id === p.category)!;
  const materialNames = p.requirements
    .filter((r) => materialById[r.choices[0].materialId]?.kind !== "tool")
    .slice(0, 3)
    .map((r) => {
      const m = materialById[r.choices[0].materialId];
      return t(m.name, m.en);
    });
  const match = inventory.length ? matchProject(p, inventory) : null;
  return (
    <article className="project-card">
      <a
        className="card-art-link"
        href={`#/project/${p.id}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProjectArt kind={p.icon} />
        <span className="art-label">{t(category.th, category.en)}</span>
        <span className="art-arrow">
          <ArrowUpRight size={20} />
        </span>
      </a>
      <div className="card-content">
        <div className="card-meta">
          <span>
            <Clock size={14} />
            {t(`ประมาณ ${p.minutes} นาที`, `About ${p.minutes} min`)}
          </span>
          <span>
            {p.level === 1
              ? t("เริ่มต้น", "Beginner")
              : t("มีพื้นฐาน", "Some experience")}
          </span>
        </div>
        <h3>
          <a href={`#/project/${p.id}`}>{p.title}</a>
        </h3>
        <p>{p.description}</p>
        <div className="material-chips">
          {materialNames.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
        <div className="card-bottom">
          <span>
            {match
              ? t(
                  `มีที่ตรวจแล้ว ${match.fulfilled}/${match.requirements.length} รายการ`,
                  `${match.fulfilled}/${match.requirements.length} checked materials`,
                )
              : t(
                  `${p.steps.length} ขั้นตอน · อ่านได้เลย`,
                  `${p.steps.length} steps · Open guide`,
                )}
          </span>
          <BookOpen size={16} />
        </div>
      </div>
    </article>
  );
}
