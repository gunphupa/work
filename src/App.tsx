import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Camera,
  Package,
  Compass,
  Hammer,
  BookOpen,
  Leaf,
  Check,
  ChevronRight,
  Clock,
  SlidersHorizontal,
  Upload,
  Download,
  Trash2,
  Pencil,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Menu,
  X,
  RotateCcw,
  Lightbulb,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { projects, projectById } from "./data/projects";
import { materials, materialById } from "./data/materials";
import {
  emptyState,
  parseInventory,
  importState,
  downloadState,
  mergeConfirmed,
} from "./domain/inventory";
import {
  matchProject,
  recommend,
  stateLabels,
  statusLabels,
  type Filters,
  type Match,
} from "./domain/matching";
import {
  type InventoryItem,
  type SavedState,
  type Project,
  type Progress,
  itemSchema,
} from "./domain/schema";
import { preparePhotos } from "./domain/images";
import { ProjectArt } from "./components/Art";
import { Modal } from "./components/Modal";
import type { AIAnswer, AIRequest } from "../server/ai";
const STORE = "rebuild.guest.v1";
const initialFilters: Filters = {
  category: "all",
  level: "all",
  time: "all",
  purchases: true,
  interest: "all",
  toolsOnly: false,
  query: "",
};
function readLocal() {
  try {
    const raw = localStorage.getItem(STORE);
    return {
      state: raw ? importState(raw) : structuredClone(emptyState),
      error: "",
    };
  } catch {
    return {
      state: structuredClone(emptyState),
      error:
        "อ่านข้อมูลที่บันทึกไว้ไม่ได้ ข้อมูลเดิมยังเก็บอยู่ กรุณาส่งออกข้อมูลเดิมก่อนนำเข้าหรือเริ่มใหม่",
    };
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
  const [initial] = useState(readLocal),
    [state, setState] = useState<SavedState>(initial.state),
    [storageError, setStorageError] = useState(initial.error),
    [paused, setPaused] = useState(!!initial.error);
  const [health, setHealth] = useState<
      "checking" | "online" | "offline" | "error"
    >("checking"),
    [notice, setNotice] = useState(""),
    [menu, setMenu] = useState(false),
    [editor, setEditor] = useState<InventoryItem | "new" | null>(null),
    [addMode, setAddMode] = useState<"bulk" | "photo" | null>(null),
    [filters, setFilters] = useState(initialFilters),
    [catalogueQuery, setCatalogueQuery] = useState("");
  const route = useRoute();
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (paused) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
      setStorageError("");
    } catch {
      setStorageError(
        "พื้นที่จัดเก็บเต็มหรือใช้ไม่ได้ กรุณาส่งออกข้อมูลก่อนออกจากหน้านี้",
      );
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
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const inventory = state.inventory;
  const matches = recommend(projects, inventory, filters);
  const project =
    route.startsWith("/project/") || route.startsWith("/build/")
      ? projectById[route.split("/")[2]]
      : undefined;
  const updateItem = (item: InventoryItem) => {
    if (inventory.length >= 500 && !inventory.some((i) => i.id === item.id)) {
      setNotice("คลังเต็ม 500 รายการ กรุณาส่งออกและลบบางรายการก่อน");
      return;
    }
    setState((s) => ({
      ...s,
      inventory: s.inventory.some((i) => i.id === item.id)
        ? s.inventory.map((i) => (i.id === item.id ? item : i))
        : [...s.inventory, item],
    }));
    setEditor(null);
    setNotice("บันทึกรายการแล้ว ผลโปรเจกต์อัปเดตตามของที่มี");
  };
  const addCandidates = (items: InventoryItem[]) => {
    if (inventory.length + items.length > 500) {
      setNotice("รายการรวมเกิน 500 กรุณาลดจำนวนรายการก่อนเพิ่ม");
      return;
    }
    setState((s) => ({
      ...s,
      inventory: [...s.inventory, ...items].slice(0, 500),
    }));
    setAddMode(null);
    setNotice("เพิ่มรายการที่รอยืนยันแล้ว ตรวจชนิด จำนวน และสเปกก่อนเริ่มทำ");
    go("/inventory");
  };
  const saveBuild = (id: string) => {
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
  const loadSample = () => {
    if (inventory.length > 497) {
      setNotice("คลังเต็ม กรุณาส่งออกและลบบางรายการก่อน");
      return;
    }
    if (
      !confirm(
        "เพิ่มคลังตัวอย่าง Arduino, สาย USB และคอมพิวเตอร์? ข้อมูลนี้เป็นตัวอย่าง ไม่ใช่ของจริงของคุณ",
      )
    )
      return;
    const sample: InventoryItem[] = projects[0].requirements.map((r) => ({
      id: crypto.randomUUID(),
      materialId: r.choices[0].materialId,
      label: `[ตัวอย่าง] ${r.label}`,
      quantity: r.quantity,
      unit: materialById[r.choices[0].materialId].unit,
      condition: "usable",
      specs: Object.fromEntries(
        Object.entries(r.choices[0].specs ?? {}).map(([k, v]) => [k, v[0]]),
      ),
      verified: true,
      notes: "ข้อมูลตัวอย่างที่ผู้ใช้เลือกโหลด ไม่ใช่หลักฐานว่ามีของจริง",
    }));
    setState((s) => ({ ...s, inventory: [...s.inventory, ...sample] }));
    go("/inventory");
  };
  async function onImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw Error();
      const next = importState(await file.text());
      if (
        !confirm(
          "แทนที่คลังและความคืบหน้าบนอุปกรณ์นี้ด้วยไฟล์ที่เลือก? ควรส่งออกข้อมูลปัจจุบันก่อน",
        )
      )
        return;
      setPaused(false);
      setState(next);
      setNotice("นำเข้าข้อมูลสำเร็จ");
    } catch {
      setNotice(
        "นำเข้าไม่ได้: ไฟล์ต้องเป็นข้อมูล ReBuild รุ่น 1 ที่ถูกต้อง ไม่เกิน 2 MB",
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  const nav = [
    ["/", "หน้าหลัก", Leaf],
    ["/explore", "ค้นหาโปรเจกต์", Compass],
    ["/inventory", "ของที่มี", Package],
    ["/builds", "โต๊ะทำงาน", Hammer],
  ] as const;
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
        ข้ามไปเนื้อหา
      </a>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="ReBuild หน้าหลัก">
          <span className="brand-mark">
            <RotateCcw size={23} />
          </span>
          ReBuild<span className="brand-dot">.</span>
        </a>
        <nav aria-label="เมนูหลัก" className={menu ? "nav open" : "nav"}>
          {nav.map(([path, label, Icon]) => (
            <a
              key={path}
              href={"#" + path}
              onClick={() => setMenu(false)}
              className={route === path ? "active" : ""}
            >
              <Icon size={16} />
              {label}
              {path === "/inventory" && inventory.length > 0 && (
                <span className="nav-count">{inventory.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="guest">
          <span className="online-dot" />
          พื้นที่ของคุณ <span className="guest-avatar">G</span>
        </div>
        <button
          className="mobile-menu icon-button"
          aria-label="เปิดเมนู"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="main" tabIndex={-1}>
        {storageError && (
          <div className="notice error" role="alert">
            {storageError}
            <button
              onClick={() => {
                const raw = localStorage.getItem(STORE);
                if (raw) {
                  const a = document.createElement("a");
                  const url = URL.createObjectURL(
                    new Blob([raw], { type: "text/plain" }),
                  );
                  a.href = url;
                  a.download = "rebuild-recovery.txt";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
              }}
            >
              ดาวน์โหลดข้อมูลเดิม
            </button>
            <button
              onClick={() => {
                if (confirm("เริ่มใหม่และแทนที่ข้อมูลเดิม?")) {
                  setPaused(false);
                  setState(structuredClone(emptyState));
                }
              }}
            >
              เริ่มใหม่
            </button>
          </div>
        )}
        {route === "/" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> LITTLE THINGS. NEW POSSIBILITIES.
                </div>
                <h1>
                  ของเดิมที่คุณมี
                  <br />
                  เป็นอะไร<span className="accent-word">ได้อีก?</span>
                </h1>
                <p className="hero-description">
                  เปลี่ยนของรอบตัวให้เป็นโปรเจกต์ที่มีความหมาย
                  <br className="desktop-break" /> ค้นพบไอเดีย เรียนรู้
                  และลงมือสร้างไปทีละขั้น
                </p>
                <div className="hero-actions">
                  <button
                    className="primary large"
                    onClick={() => go("/inventory")}
                  >
                    <Plus size={20} />
                    เพิ่มของที่มี
                    <ArrowUpRight size={19} />
                  </button>
                  <a href="#/explore" className="text-link">
                    มีไอเดียแล้ว? หาโปรเจกต์ <ArrowRight size={17} />
                  </a>
                </div>
                <div className="hero-footnote">
                  <ShieldCheck size={16} />
                  เริ่มได้เลย ไม่ต้องสมัคร · บันทึกในเบราว์เซอร์ของคุณ
                </div>
              </div>
              <div className="hero-visual">
                <div className="paper-tab">THE POSSIBILITY LAB</div>
                <ProjectArt hero />
                <div className="visual-caption">
                  <span className="small-icon">
                    <Lightbulb size={19} />
                  </span>
                  <div>
                    <strong>เริ่มจากชิ้นเล็ก ๆ ที่มีอยู่</strong>
                    <span>แล้วปล่อยให้ความอยากรู้พาไป</span>
                  </div>
                  <span className="caption-star">✳</span>
                </div>
              </div>
            </section>
            <section className="process-strip" aria-label="วิธีใช้">
              <div>
                <span className="step-number">01</span>
                <div>
                  <h3>สำรวจของที่มี</h3>
                  <p>พิมพ์รายการ หรือใช้ภาพเมื่อเชื่อมต่อ AI</p>
                </div>
                <Package />
              </div>
              <div>
                <span className="step-number">02</span>
                <div>
                  <h3>ค้นพบความเป็นไปได้</h3>
                  <p>เช็กของ สเปก และสิ่งที่ต้องหาเพิ่ม</p>
                </div>
                <Compass />
              </div>
              <div>
                <span className="step-number">03</span>
                <div>
                  <h3>ลงมือ แล้วเรียนรู้</h3>
                  <p>ทำตามคู่มือ บันทึกผล ต่อยอดไอเดีย</p>
                </div>
                <Hammer />
              </div>
            </section>
            <section className="section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">A GOOD PLACE TO START</div>
                  <h2>ชิ้นเล็ก ๆ จุดประกายไอเดียใหญ่</h2>
                  <p>
                    ลองสำรวจโปรเจกต์จาก Arduino และ NASA
                    ที่เราอ่านและเรียบเรียงไว้
                  </p>
                </div>
                <a href="#/explore" className="text-link">
                  ดูทั้ง {projects.length} โปรเจกต์ <ArrowRight size={18} />
                </a>
              </div>
              <div className="project-grid">
                {["fade", "straw-rocket", "melody"].map((id) => (
                  <ProjectCard
                    key={id}
                    match={matchProject(projectById[id], inventory)}
                  />
                ))}
              </div>
            </section>
            <section className="invitation">
              <div className="invitation-icon">
                <Leaf size={40} />
              </div>
              <div>
                <h2>ไม่ต้องมีของครบ ก็เริ่มสำรวจได้</h2>
                <p>เราจะบอกว่ามีอะไรแล้ว อะไรยังขาด และอะไรต้องตรวจสอบก่อน</p>
              </div>
              <button className="secondary" onClick={loadSample}>
                ลองด้วยคลังตัวอย่าง <ArrowUpRight size={18} />
              </button>
            </section>
          </>
        )}
        {route === "/inventory" && (
          <>
            <PageHeading
              eyebrow="YOUR MATERIALS, YOUR POSSIBILITIES"
              title="ของที่มี"
              description="เริ่มจากของใกล้ตัว ยืนยันข้อมูลเท่าที่รู้ และเก็บสิ่งที่ยังไม่แน่ใจไว้ก่อนได้"
              action={
                <button className="primary" onClick={() => setEditor("new")}>
                  <Plus size={18} />
                  เพิ่มของที่มี
                </button>
              }
            />
            <div className="inventory-layout">
              <section>
                <div className="quick-actions">
                  <button
                    className="action-tile"
                    onClick={() => setAddMode("bulk")}
                  >
                    <Pencil />
                    <strong>พิมพ์หลายรายการ</strong>
                    <span>รองรับชื่อไทยและ English</span>
                  </button>
                  <button
                    className="action-tile"
                    onClick={() => setAddMode("photo")}
                  >
                    <Camera />
                    <strong>เพิ่มจากรูปภาพ</strong>
                    <span>
                      {health === "online"
                        ? "ให้ AI ช่วยดู แล้วคุณยืนยัน"
                        : "ต้องเชื่อมต่อ AI ก่อนวิเคราะห์"}
                    </span>
                  </button>
                </div>
                {inventory.length === 0 ? (
                  <div className="empty-state">
                    <Package size={42} />
                    <h2>ทุกไอเดีย เริ่มจากของสักชิ้น</h2>
                    <p>
                      เพิ่มบอร์ด ชิ้นส่วน เครื่องมือ หรือของรอบตัว
                      <br />
                      ยังไม่รู้ชื่อ? บันทึกเป็น “ของอื่น” ไว้ก่อนได้
                    </p>
                    <button
                      className="primary"
                      onClick={() => setEditor("new")}
                    >
                      เพิ่มชิ้นแรก <Plus size={18} />
                    </button>
                    <button className="text-link" onClick={loadSample}>
                      หรือทดลองด้วยข้อมูลตัวอย่าง
                    </button>
                  </div>
                ) : (
                  <>
                    {(["component", "material", "tool"] as const).map(
                      (kind) => {
                        const group = inventory.filter(
                          (i) =>
                            (materialById[i.materialId]?.kind ?? "material") ===
                            kind,
                        );
                        return (
                          group.length > 0 && (
                            <section className="inventory-group" key={kind}>
                              <h2>
                                {kind === "tool"
                                  ? "เครื่องมือ"
                                  : kind === "material"
                                    ? "วัสดุและของรอบตัว"
                                    : "ชิ้นส่วนและอุปกรณ์"}{" "}
                                <span>{group.length}</span>
                              </h2>
                              {group.map((item) => (
                                <div className="inventory-row" key={item.id}>
                                  <span className="item-icon">
                                    {kind === "tool" ? <Hammer /> : <Package />}
                                  </span>
                                  <div className="item-info">
                                    <strong>{item.label}</strong>
                                    <span>
                                      {materialById[item.materialId]?.name ??
                                        "ของอื่น"}{" "}
                                      · {item.quantity} {item.unit}
                                    </span>
                                    <span
                                      className={`item-state ${item.verified ? "confirmed" : ""}`}
                                    >
                                      {item.verified ? (
                                        <Check size={13} />
                                      ) : (
                                        <AlertCircle size={13} />
                                      )}{" "}
                                      {item.verified
                                        ? "ยืนยันข้อมูลที่กรอกแล้ว"
                                        : "รอยืนยันชนิดและสเปก"}
                                      {item.condition === "damaged"
                                        ? " · ชำรุด"
                                        : ""}
                                    </span>
                                    {Object.keys(item.specs).length > 0 && (
                                      <small>
                                        {Object.values(item.specs).join(" · ")}
                                      </small>
                                    )}
                                  </div>
                                  <button
                                    className="icon-button"
                                    aria-label={`แก้ไข ${item.label}`}
                                    onClick={() => setEditor(item)}
                                  >
                                    <Pencil size={17} />
                                  </button>
                                  <button
                                    className="icon-button danger"
                                    aria-label={`ลบ ${item.label}`}
                                    onClick={() => {
                                      if (
                                        confirm(`ลบ ${item.label} ออกจากคลัง?`)
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
                                </div>
                              ))}
                            </section>
                          )
                        );
                      },
                    )}
                    <button
                      className="secondary"
                      onClick={() => {
                        if (
                          confirm(
                            "รวมรายการชื่อเดียวกัน สเปกและสถานะตรงกัน แล้วบวกจำนวน? ตรวจว่าไม่ใช่รูปซ้ำของชิ้นเดิมก่อน",
                          )
                        )
                          setState((s) => ({
                            ...s,
                            inventory: mergeConfirmed(s.inventory),
                          }));
                      }}
                    >
                      รวมรายการที่เหมือนกัน
                    </button>
                  </>
                )}
              </section>
              <aside className="inventory-aside">
                <div className="panel green-panel">
                  <span className="eyebrow">YOUR NEXT STEP</span>
                  <h2>พร้อมต่อยอดหรือยัง?</h2>
                  <p>
                    มี {inventory.length} รายการในคลัง
                    <br />
                    ยืนยันแล้ว {inventory.filter((i) => i.verified).length}{" "}
                    รายการ
                  </p>
                  <button className="primary" onClick={() => go("/explore")}>
                    หาโปรเจกต์จากของที่มี <ArrowRight size={18} />
                  </button>
                </div>
                <div className="panel">
                  <h3>
                    <ShieldCheck size={19} /> พื้นที่ส่วนตัวบนเครื่องนี้
                  </h3>
                  <p>
                    ข้อมูลเก็บในเบราว์เซอร์นี้ ไม่มีบัญชีหรือการซิงก์ข้ามเครื่อง
                    ส่งออกไว้ก่อนล้างข้อมูลเบราว์เซอร์
                  </p>
                  <div className="data-actions">
                    <button
                      className="secondary"
                      onClick={() => downloadState(state)}
                    >
                      <Download size={16} />
                      ส่งออก
                    </button>
                    <button
                      className="secondary"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={16} />
                      นำเข้า
                    </button>
                  </div>
                  <button
                    className="text-link danger"
                    onClick={() => {
                      if (
                        confirm(
                          "ลบคลังและความคืบหน้าทั้งหมดบนเบราว์เซอร์นี้? การลบย้อนกลับไม่ได้หากไม่มีไฟล์สำรอง",
                        )
                      ) {
                        setState(structuredClone(emptyState));
                        setPaused(false);
                      }
                    }}
                  >
                    ล้างข้อมูลทั้งหมด
                  </button>
                </div>
                <div className="tip">
                  <Lightbulb size={20} />
                  <p>
                    ภาพหลายมุมอาจเป็นชิ้นเดียวกัน ตรวจจำนวนก่อนเพิ่ม
                    เราไม่รวมภาพเป็นจำนวนของโดยอัตโนมัติ
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
        {route === "/explore" && (
          <>
            <PageHeading
              eyebrow="FIND YOUR NEXT BUILD"
              title="ของที่มี พาคุณไปได้ไกลแค่ไหน"
              description="ตรวจความพร้อมจากคลังเดียวกัน ทุกโปรเจกต์มีที่มา และบอกสิ่งที่ยังต้องตรวจสอบ"
            />
            <div className="explore-toolbar">
              <label className="search-field">
                <Search size={20} />
                <input
                  placeholder="อยากทำอะไร? เช่น ไฟ ปุ่ม เซนเซอร์"
                  aria-label="ค้นหาโปรเจกต์ที่อยากทำ"
                  value={filters.query}
                  onChange={(e) =>
                    setFilters({ ...filters, query: e.target.value })
                  }
                />
              </label>
              <a className="secondary" href="#/inventory">
                <Package size={17} />
                ของที่มี {inventory.length} รายการ
              </a>
            </div>
            <div className="filters">
              <SlidersHorizontal size={18} />
              <label>
                หมวดหมู่
                <select
                  value={filters.category}
                  onChange={(e) =>
                    setFilters({ ...filters, category: e.target.value })
                  }
                >
                  <option value="all">ทุกหมวด</option>
                  <option value="electronics">อิเล็กทรอนิกส์</option>
                  <option value="craft">งานประดิษฐ์</option>
                </select>
              </label>
              <label>
                ระดับ
                <select
                  value={filters.level}
                  onChange={(e) =>
                    setFilters({ ...filters, level: e.target.value })
                  }
                >
                  <option value="all">ทุกระดับ</option>
                  <option value="1">เริ่มต้น</option>
                  <option value="2">มีพื้นฐาน</option>
                </select>
              </label>
              <label>
                เวลา
                <select
                  value={filters.time}
                  onChange={(e) =>
                    setFilters({ ...filters, time: e.target.value })
                  }
                >
                  <option value="all">ไม่จำกัด</option>
                  <option value="20">ไม่เกิน 20 นาที</option>
                  <option value="30">ไม่เกิน 30 นาที</option>
                </select>
              </label>
              <label>
                สนใจ
                <select
                  value={filters.interest}
                  onChange={(e) =>
                    setFilters({ ...filters, interest: e.target.value })
                  }
                >
                  <option value="all">ทุกหัวข้อ</option>
                  <option>แสงและเสียง</option>
                  <option>เซนเซอร์และโค้ด</option>
                  <option>การเคลื่อนที่</option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!filters.purchases}
                  onChange={(e) =>
                    setFilters({ ...filters, purchases: !e.target.checked })
                  }
                />
                ไม่หาของเพิ่ม
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={filters.toolsOnly}
                  onChange={(e) =>
                    setFilters({ ...filters, toolsOnly: e.target.checked })
                  }
                />
                มีเครื่องมือครบ
              </label>
            </div>
            <div className="catalogue-note">
              <BookOpen size={17} />
              <span>
                ชุดเริ่มต้น {projects.length} โปรเจกต์ Arduino และงานประดิษฐ์ ·
                ตรวจจากเอกสาร · ยังไม่ได้ทดสอบประกอบจริง
              </span>
            </div>
            {inventory.length === 0 && (
              <div className="notice">
                ยังไม่ได้เพิ่มของ แสดงรายการทั้งหมดเพื่อให้สำรวจก่อน{" "}
                <a href="#/inventory">เพิ่มของเพื่อตรวจความพร้อม →</a>
              </div>
            )}
            {matches.length === 0 ? (
              <div className="empty-state">
                <Compass size={38} />
                <h2>ยังไม่พบโปรเจกต์ที่ตรงเงื่อนไข</h2>
                <p>
                  คลังของคุณยังอยู่ ลองปรับตัวกรอง หรือดูขอบเขตวัสดุที่รองรับ
                  <br />
                  บางวัสดุ เช่น ขวดและมอเตอร์ ยังไม่มีคู่มือที่ตรวจแล้ว
                </p>
                <button
                  className="secondary"
                  onClick={() => setFilters(initialFilters)}
                >
                  ล้างตัวกรอง
                </button>
                <a className="text-link" href="#/materials">
                  ดูวัสดุที่รองรับ
                </a>
              </div>
            ) : (
              <>
                {(["ready", "verify", "missing"] as const).map((group) => {
                  const list = matches.filter((m) => m.state === group);
                  return (
                    list.length > 0 && (
                      <section className="results-group" key={group}>
                        <h2>
                          <span className={`state-dot ${group}`} />
                          {stateLabels[group]}{" "}
                          <span className="result-count">{list.length}</span>
                        </h2>
                        <div className="project-grid">
                          {list.map((m) => (
                            <ProjectCard key={m.project.id} match={m} />
                          ))}
                        </div>
                      </section>
                    )
                  );
                })}
              </>
            )}
          </>
        )}
        {project && route.startsWith("/project/") && (
          <ProjectDetail
            project={project}
            inventory={inventory}
            start={() => saveBuild(project.id)}
          />
        )}
        {project && route.startsWith("/build/") && (
          <BuildView
            project={project}
            inventory={inventory}
            progress={state.builds.find((b) => b.projectId === project.id)}
            onStart={() => saveBuild(project.id)}
            update={updateBuild}
            health={health}
            conflicts={state.builds
              .filter(
                (b) =>
                  b.projectId !== project.id &&
                  b.completed.length <
                    (projectById[b.projectId]?.steps.length ?? 0),
              )
              .map((b) => projectById[b.projectId]?.title)
              .filter(Boolean)}
          />
        )}
        {route === "/builds" && (
          <>
            <PageHeading
              eyebrow="MAKE. LEARN. REPEAT."
              title="โต๊ะทำงานของคุณ"
              description="ทีละขั้น ทีละไอเดีย ความคืบหน้าและบันทึกเก็บอยู่ในเบราว์เซอร์นี้"
              action={
                <a href="#/explore" className="secondary">
                  หาโปรเจกต์ <Plus size={18} />
                </a>
              }
            />
            {state.builds.length === 0 ? (
              <div className="empty-state">
                <Hammer size={42} />
                <h2>เว้นที่ไว้ให้ไอเดียแรกของคุณ</h2>
                <p>เลือกโปรเจกต์ แล้วกดบันทึกลงโต๊ะทำงาน</p>
                <a href="#/explore" className="primary">
                  ค้นหาโปรเจกต์ <ArrowRight size={18} />
                </a>
              </div>
            ) : (
              <div className="project-grid">
                {state.builds.map((b) => {
                  const p = projectById[b.projectId];
                  return (
                    p && (
                      <article className="project-card" key={b.projectId}>
                        <ProjectArt kind={p.icon} />
                        <div className="card-content">
                          <div className="eyebrow">
                            {b.completed.length} / {p.steps.length} ขั้นตอน
                          </div>
                          <h2>{p.title}</h2>
                          <p>
                            {b.notes ||
                              "ยังไม่มีบันทึก เริ่มเก็บสิ่งที่เรียนรู้กัน"}
                          </p>
                          <a href={`#/build/${p.id}`} className="text-link">
                            ทำต่อ <ArrowRight size={18} />
                          </a>
                          <button
                            className="icon-button danger"
                            aria-label={`ลบงาน ${p.title}`}
                            onClick={() => {
                              if (confirm("ลบงานและบันทึกนี้?"))
                                setState((s) => ({
                                  ...s,
                                  builds: s.builds.filter(
                                    (x) => x.projectId !== p.id,
                                  ),
                                }));
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </article>
                    )
                  );
                })}
              </div>
            )}
          </>
        )}
        {route === "/materials" && (
          <>
            <PageHeading
              eyebrow="KNOW WHAT YOU CAN USE"
              title="วัสดุที่รองรับ"
              description="เก็บของได้ทุกประเภท แต่การตรวจความพร้อมรองรับเฉพาะชิ้นส่วนที่มีคู่มือในชุดเริ่มต้น"
            />
            <label className="search-field">
              <Search size={20} />
              <input
                value={catalogueQuery}
                onChange={(e) => setCatalogueQuery(e.target.value)}
                placeholder="ค้นหาชื่อไทยหรือ English"
                aria-label="ค้นหาวัสดุ"
              />
            </label>
            <div className="materials-grid">
              {materials
                .filter((m) =>
                  `${m.name} ${m.en} ${m.aliases.join(" ")}`
                    .toLowerCase()
                    .includes(catalogueQuery.toLowerCase()),
                )
                .map((m) => {
                  const linked = projects.filter((p) =>
                    p.requirements.some((r) =>
                      r.choices.some((c) => c.materialId === m.id),
                    ),
                  );
                  return (
                    <article className="panel" key={m.id}>
                      <Package size={22} />
                      <h2>{m.name}</h2>
                      <p>{m.en}</p>
                      <p>
                        {m.hint || "ตรวจชนิดและสเปกให้ตรงก่อนเริ่มโปรเจกต์"}
                      </p>
                      <span className="badge">
                        {linked.length
                          ? `${linked.length} โปรเจกต์รองรับ`
                          : "เก็บในคลังได้ · ยังไม่มีคู่มือ"}
                      </span>
                      {linked.slice(0, 3).map((p) => (
                        <a
                          className="catalogue-project"
                          href={`#/project/${p.id}`}
                          key={p.id}
                        >
                          {p.title} <ChevronRight size={14} />
                        </a>
                      ))}
                    </article>
                  );
                })}
            </div>
          </>
        )}
        {route === "/about" && (
          <>
            <PageHeading
              eyebrow="A LITTLE MORE ABOUT REBUILD"
              title="สร้างสิ่งใหม่ เรียนรู้จากของเดิม"
              description="เครื่องมือช่วยวางแผนโปรเจกต์วิศวกรรมและการเรียนรู้ สำหรับคนที่อยากเริ่มจากของที่มี"
            />
            <div className="prose panel">
              <h2>ใช้อย่างไร</h2>
              <ol>
                <li>เพิ่มของและเครื่องมือ พิมพ์ชื่อไทยหรืออังกฤษได้</li>
                <li>
                  ยืนยันชนิด จำนวน สภาพ และสเปกที่ทราบ ปล่อย “ไม่ทราบ”
                  สำหรับสิ่งที่ยังต้องตรวจ
                </li>
                <li>เลือกโปรเจกต์ อ่านรายการที่ขาดและคู่มือต้นทาง</li>
                <li>บันทึกลงโต๊ะทำงาน ทำทีละขั้น และจดผลที่วัดเอง</li>
              </ol>
              <h2>AI ช่วยตรงไหน</h2>
              <p>
                เมื่อผู้ดูแลเชื่อมต่อบริการ AI จะช่วยอ่านข้อความ ดูภาพ
                และอธิบายโปรเจกต์ คุณต้องยืนยันข้อมูลเองเสมอ
                สถานะพร้อมทำคำนวณจากกฎตรวจรายการและสเปก ไม่ใช้ความมั่นใจของ AI
                แทนหลักฐาน
              </p>
              <h2>ข้อมูลและความเป็นส่วนตัว</h2>
              <p>
                คลัง ความคืบหน้า และบันทึกเก็บใน localStorage ของเบราว์เซอร์
                ไม่มี cloud sync ล้างหรือนำออกได้ที่ “ของที่มี”
                รูปสำหรับระบุสิ่งของเก็บชั่วคราวในหน้านี้
                ไม่บันทึกไว้บนเซิร์ฟเวอร์ ก่อนส่งให้ AI ต้องยินยอมทุกครั้ง
              </p>
              <p>
                เมื่อใช้ AI ข้อความ รูปที่เลือก คลัง และบริบทโปรเจกต์อาจส่งให้
                OpenAI ตามบริการที่ผู้ดูแลตั้งค่า
                การลบข้อมูลในเบราว์เซอร์ไม่ได้ลบข้อมูลที่ผู้ให้บริการได้รับแล้ว
                เราไม่รับรองเงื่อนไขการเก็บข้อมูลหรือการใช้ฝึกโมเดลของผู้ให้บริการ
              </p>
              <p>
                เซิร์ฟเวอร์ใช้คุกกี้เซสชันแบบ HttpOnly และตัวนับโควตารายวัน
                เก็บแฮชของ IP เพื่อจำกัดการใช้งาน ไม่บันทึกรูป คีย์
                หรือข้อความลง log ตัวนับหมดอายุและลบเมื่อมีคำขอถัดไป
              </p>
              <h2>ขอบเขตและงานวิจัย</h2>
              <p>
                รุ่นเริ่มต้นมี {projects.length} โปรเจกต์จาก Arduino และ NASA
                จากเอกสารทางการ ยังไม่ได้ทดสอบชิ้นงานจริง งานประดิษฐ์อื่น
                วัสดุกู้คืน มอเตอร์
                และรุ่นบอร์ดอื่นต้องเพิ่มคู่มือที่ผ่านการตรวจ ไม่รองรับไฟบ้าน
                แบตเตอรี่เสียหาย หรือโครงสร้างรับน้ำหนักคน
              </p>
              <p>
                เอกสารสนับสนุนรายงาน 5 บทอยู่ในโครงการซอร์สโค้ด
                ผลการศึกษาในคนและการใช้งานวัสดุจริงยังไม่ได้เก็บ
                ไม่มีการอ้างผลการเรียนรู้หรือการลดขยะที่ยังไม่วัด
              </p>
            </div>
          </>
        )}
        {![
          "/",
          "/inventory",
          "/explore",
          "/builds",
          "/materials",
          "/about",
        ].includes(route) &&
          !project && (
            <div className="empty-state">
              <h1>ไม่พบหน้านี้</h1>
              <a href="#/">กลับหน้าหลัก</a>
            </div>
          )}
      </main>
      <footer>
        <div>
          <a className="brand footer-brand" href="#/">
            ReBuild<span className="brand-dot">.</span>
          </a>
          <span>ของเดิม ไอเดียใหม่ ความเป็นไปได้ไม่รู้จบ</span>
        </div>
        <nav aria-label="ข้อมูลเพิ่มเติม">
          <a href="#/materials">วัสดุที่รองรับ</a>
          <a href="#/about">เกี่ยวกับเราและความเป็นส่วนตัว</a>
        </nav>
        <span className="service-status">
          <span
            className={`online-dot ${health === "online" ? "" : "muted"}`}
          />
          {health === "online"
            ? "AI เชื่อมต่อการตั้งค่าแล้ว"
            : health === "checking"
              ? "กำลังตรวจบริการ"
              : health === "error"
                ? "ติดต่อบริการไม่ได้ · ใช้คลังออฟไลน์ได้"
                : "โหมดคลังความรู้ · AI ยังไม่เชื่อมต่อ"}
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
          <button
            className="icon-button"
            aria-label="ปิดข้อความ"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {editor && (
        <ItemEditor
          item={editor === "new" ? undefined : editor}
          inventory={inventory}
          close={() => setEditor(null)}
          save={updateItem}
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
        aria-label="ไฟล์นำเข้าคลัง"
        onChange={(e) => void onImport(e.target.files?.[0])}
      />
    </>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
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
function ProjectCard({ match }: { match: Match }) {
  const p = match.project;
  return (
    <article className="project-card">
      <a
        className="card-art-link"
        href={`#/project/${p.id}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProjectArt kind={p.icon} />
        <span className="art-label">
          {p.level === 1 ? "เริ่มต้นได้ง่าย" : "ต่อยอดทักษะ"}
        </span>
        <span className="art-arrow">
          <ArrowUpRight size={20} />
        </span>
      </a>
      <div className="card-content">
        <div className="card-meta">
          <span>
            {p.category === "craft" ? "งานประดิษฐ์" : "อิเล็กทรอนิกส์"}
          </span>
          <span>
            <Clock size={13} />
            {p.minutes} นาที โดยประมาณ
          </span>
        </div>
        <h3>
          <a href={`#/project/${p.id}`}>{p.title}</a>
        </h3>
        <p>{p.description}</p>
        <div className={`readiness ${match.state}`}>
          <span className="state-dot" />
          {stateLabels[match.state]}
        </div>
        <div className="card-bottom">
          <span>{match.reason}</span>
          <BookOpen size={15} aria-label="ตรวจจากเอกสาร" />
        </div>
      </div>
    </article>
  );
}
function ItemEditor({
  item,
  inventory,
  close,
  save,
}: {
  item?: InventoryItem;
  inventory: InventoryItem[];
  close: () => void;
  save: (i: InventoryItem) => void;
}) {
  const [draft, setDraft] = useState<InventoryItem>(
    item ?? {
      id: crypto.randomUUID(),
      materialId: "uno",
      label: "Arduino Uno R3",
      quantity: 1,
      unit: "ชิ้น",
      condition: "unknown",
      verified: false,
      specs: {},
      notes: "",
    },
  );
  const [error, setError] = useState("");
  const mat = materialById[draft.materialId] ?? materialById.unknown;
  function submit(e: FormEvent) {
    e.preventDefault();
    const result = itemSchema.safeParse(draft);
    if (!result.success) {
      setError("ตรวจชื่อและจำนวนให้ถูกต้อง จำนวนต้องมากกว่า 0");
      return;
    }
    save(result.data);
  }
  return (
    <Modal title={item ? "ตรวจและแก้ไขรายการ" : "เพิ่มของที่มี"} close={close}>
      <form onSubmit={submit} className="stack">
        <label>
          ประเภทสิ่งของ
          <select
            value={draft.materialId}
            onChange={(e) => {
              const m = materialById[e.target.value];
              setDraft({
                ...draft,
                materialId: m.id,
                label: m.name,
                unit: m.unit,
                specs: {},
                verified: false,
              });
            }}
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          ชื่อที่คุณเรียก
          <input
            required
            maxLength={160}
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </label>
        <div className="form-columns">
          <label>
            จำนวน
            <input
              type="number"
              min="1"
              max="10000"
              step="1"
              required
              value={draft.quantity}
              onChange={(e) =>
                setDraft({ ...draft, quantity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            หน่วย
            <select
              value={draft.unit}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  unit: e.target.value as InventoryItem["unit"],
                })
              }
            >
              {["ชิ้น", "เส้น", "แผ่น", "เครื่อง", "ชุด"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            สภาพ
            <select
              value={draft.condition}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  condition: e.target.value as InventoryItem["condition"],
                })
              }
            >
              <option value="unknown">ยังไม่ทราบ</option>
              <option value="usable">ใช้งานได้</option>
              <option value="damaged">ชำรุด</option>
            </select>
          </label>
        </div>
        {mat.hint && <p className="form-hint">{mat.hint}</p>}
        {Object.entries(mat.specs).map(([key, spec]) => (
          <label key={key}>
            {spec.label}
            <select
              value={draft.specs[key] ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  specs: { ...draft.specs, [key]: e.target.value },
                })
              }
            >
              <option value="">ไม่ทราบ / ต้องตรวจสอบ</option>
              {spec.options.map((o) => (
                <option key={o} value={o}>
                  {o === "yes"
                    ? "ใช่"
                    : o === "no"
                      ? "ไม่ใช่"
                      : o === "other"
                        ? "รุ่นอื่น"
                        : o}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          หมายเหตุ / รุ่น / ขนาด
          <input
            maxLength={1000}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={draft.verified}
            onChange={(e) => setDraft({ ...draft, verified: e.target.checked })}
          />
          ฉันตรวจชนิด จำนวน และข้อมูลที่กรอกแล้ว
        </label>
        <p className="form-hint">
          ข้อมูลที่เลือก “ไม่ทราบ” ยังต้องตรวจ แม้ทำเครื่องหมายยืนยันแล้ว
        </p>
        {inventory.some(
          (i) => i.id !== draft.id && i.materialId === draft.materialId,
        ) && (
          <div className="notice">
            มีสิ่งของชนิดนี้อยู่แล้ว ตรวจว่าเป็นคนละชิ้น
            เราจะไม่รวมจำนวนอัตโนมัติ
          </div>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            ยกเลิก
          </button>
          <button className="primary" type="submit">
            บันทึกรายการ <Check size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
async function askAI(
  input: Partial<AIRequest>,
  signal: AbortSignal,
): Promise<AIAnswer> {
  const session = await fetch("/api/session", { signal });
  if (!session.ok) throw new Error("เริ่มเซสชันไม่ได้ โปรดลองอีกครั้ง");
  const { csrf } = await session.json();
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(input),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "บริการขัดข้อง");
  return data;
}
function AddModal({
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
  add: (i: InventoryItem[]) => void;
}) {
  const [text, setText] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [answer, setAnswer] = useState<AIAnswer | null>(null),
    [parsed, setParsed] = useState<InventoryItem[]>([]),
    [photos, setPhotos] = useState<{ mime: "image/webp"; data: string }[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(useAI: boolean) {
    setError("");
    setBusy(true);
    controller.current = new AbortController();
    try {
      if (useAI) {
        const images = mode === "photo" ? await preparePhotos(files) : [];
        setPhotos(images);
        const result = await askAI(
          {
            mode: mode === "photo" ? "photo" : "inventory",
            text,
            images,
            imageConsent: consent,
            inventory,
          },
          controller.current.signal,
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
          ? "ยกเลิกแล้ว ข้อมูลที่กรอกยังอยู่"
          : e instanceof Error
            ? e.message
            : "อ่านข้อมูลไม่ได้",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "photo" ? "ให้ภาพช่วยเล่าเรื่องของคุณ" : "เพิ่มหลายรายการ"
      }
      close={close}
    >
      <div className="stack">
        {mode === "bulk" ? (
          <label>
            รายการของที่มี (หนึ่งรายการต่อบรรทัด)
            <textarea
              rows={5}
              placeholder={
                "Arduino Uno R3 จำนวน 1\nLED จำนวน 2\nตัวต้านทาน 220 ohm จำนวน 3"
              }
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        ) : (
          <>
            <div className="notice">
              <ShieldCheck size={18} />
              รูปจะส่งให้ OpenAI เมื่อกดวิเคราะห์
              โปรดหลีกเลี่ยงใบหน้าและข้อมูลส่วนตัว รูปไม่บันทึกบนเซิร์ฟเวอร์
              เงื่อนไขการเก็บข้อมูลขึ้นกับผู้ให้บริการ
            </div>
            <label className="upload-zone">
              <Camera size={34} />
              <strong>เลือกรูปสิ่งของของคุณ</strong>
              <span>
                JPEG / PNG / WebP · สูงสุด 5 รูป · รูปละ 10 MB, 40 MP
                <br />
                ย่อเป็นด้านยาว 1600 px และลบ metadata ก่อนส่ง
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  setFiles(Array.from(e.target.files ?? []));
                  setPhotos([]);
                  setParsed([]);
                  setAnswer(null);
                }}
              />
            </label>
            <p>{files.length ? `เลือกแล้ว ${files.length} รูป` : ""}</p>
            {photos.length > 0 && (
              <div className="photo-thumbs">
                {photos.map((p, i) => (
                  <img
                    key={i}
                    src={`data:${p.mime};base64,${p.data}`}
                    alt={`รูปสิ่งของ ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <label>
              ข้อมูลเพิ่ม เช่น ชื่อบนฉลาก
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
              ยินยอมส่งรูปและข้อมูลให้บริการ AI เพื่อระบุสิ่งของ
            </label>
          </>
        )}
        {health !== "online" && (
          <p className="form-hint">
            AI ยังไม่พร้อมใช้งาน คุณเพิ่มและยืนยันของด้วยตนเองได้
          </p>
        )}
        <div className="button-row">
          {mode === "bulk" && (
            <button
              className="primary"
              disabled={busy || !text.trim()}
              onClick={() => void run(false)}
            >
              แยกรายการจากข้อความ <ArrowRight size={16} />
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
            {mode === "photo" ? "วิเคราะห์ภาพ" : "ให้ AI ช่วยอ่าน"}
          </button>
          {busy && (
            <button
              className="secondary"
              onClick={() => controller.current?.abort()}
            >
              ยกเลิก
            </button>
          )}
        </div>
        {busy && (
          <p role="status">
            <LoaderCircle className="spinner" size={18} /> กำลังอ่านข้อมูล
            กรุณารอสักครู่
          </p>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {answer && <div className="ai-answer">{answer.reply}</div>}
        {parsed.length > 0 && (
          <>
            <h3>รายการที่พบ · ยังไม่ยืนยัน</h3>
            <p className="form-hint">
              ตรวจว่ารูปหลายใบแสดงของชิ้นเดิมหรือไม่ ลบข้อเสนอซ้ำก่อนเพิ่ม
              แล้วแก้จำนวนและสเปกในคลัง
            </p>
            {parsed.map((item, i) => (
              <div className="candidate" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <p>
                    {materialById[item.materialId]?.name} · {item.quantity}{" "}
                    {item.unit}
                  </p>
                  {answer?.candidates[i] && (
                    <small>
                      {answer.candidates[i].confidence} ·{" "}
                      {answer.candidates[i].evidence}
                      <br />
                      {answer.candidates[i].alternatives.length > 0 &&
                        `อาจเป็น: ${answer.candidates[i].alternatives.join(", ")}`}
                      <br />
                      {answer.candidates[i].questions.join(" ")}
                    </small>
                  )}
                </div>
                <button
                  className="icon-button"
                  aria-label={`ไม่เพิ่ม ${item.label}`}
                  onClick={() => {
                    setParsed((p) => p.filter((x) => x.id !== item.id));
                    if (answer)
                      setAnswer({
                        ...answer,
                        candidates: answer.candidates.filter(
                          (_, index) => index !== i,
                        ),
                      });
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button className="primary" onClick={() => add(parsed)}>
              เพิ่ม {parsed.length} รายการเพื่อยืนยัน <Check size={17} />
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
function Requirements({ match }: { match: Match }) {
  return (
    <div className="requirements">
      {match.requirements.map((r) => (
        <div className={`requirement ${r.status}`} key={r.requirement.id}>
          <span className="requirement-icon">
            {r.status === "satisfied" ? (
              <CheckCircle2 size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
          </span>
          <div>
            <strong>{r.requirement.label}</strong>
            <p>{r.requirement.why}</p>
            <small>
              {r.requirement.choices
                .map((c) =>
                  Object.values(c.specs ?? {})
                    .map((v) => v.join(" หรือ "))
                    .join(" · "),
                )
                .join(" / ")}
            </small>
          </div>
          <div className="requirement-count">
            <strong>
              {r.available} / {r.requirement.quantity}
            </strong>
            <span>{statusLabels[r.status]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
function SourceCard({ project }: { project: Project }) {
  const s = project.source;
  return (
    <div className="source-card">
      <div className="source-icon">
        <BookOpen size={23} />
      </div>
      <div>
        <div className="eyebrow">OFFICIAL DOCUMENTATION</div>
        <h3>{s.title}</h3>
        <p>
          {s.author} · {s.language}
        </p>
        <p>{s.inspection}</p>
        <small>
          ตรวจเนื้อหา {s.checkedAt} ·{" "}
          {s.commit
            ? `ไฟล์อ้างอิงเวอร์ชัน ${s.commit.slice(0, 7)}`
            : "ตรวจหน้าเว็บ ณ วันที่ระบุ"}
        </small>
        <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
          อ่านคู่มือต้นทาง <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}
function ProjectDetail({
  project: p,
  inventory,
  start,
}: {
  project: Project;
  inventory: InventoryItem[];
  start: () => void;
}) {
  const [tab, setTab] = useState("parts");
  const match = matchProject(p, inventory);
  const missing = match.requirements.filter((r) => r.status !== "satisfied");
  return (
    <>
      <a className="back-link" href="#/explore">
        ← กลับไปค้นหาโปรเจกต์
      </a>
      <div className="detail-hero">
        <div>
          <div className="eyebrow">PROJECT / {p.id.toUpperCase()}</div>
          <h1>{p.title}</h1>
          <p className="detail-description">{p.description}</p>
          <div className="detail-meta">
            <span>
              <Clock size={17} />
              {p.minutes} นาที โดยประมาณ
            </span>
            <span>ระดับ{p.level === 1 ? "เริ่มต้น" : "มีพื้นฐาน"}</span>
            <span>
              <BookOpen size={17} />
              ตรวจจากเอกสาร
            </span>
          </div>
          <div className={`readiness ${match.state}`}>
            <span className="state-dot" />
            {stateLabels[match.state]}
          </div>
          <p>
            {match.reason} · นำของที่ยืนยันแล้วมาใช้ได้ {match.reused}{" "}
            ชิ้น/หน่วยตามรายการ
          </p>
          <button className="primary" onClick={start}>
            <Hammer size={18} />
            บันทึกลงโต๊ะทำงาน <ArrowRight size={18} />
          </button>
        </div>
        <div className="detail-art">
          <ProjectArt kind={p.icon} />
        </div>
      </div>
      <div className="detail-layout">
        <section>
          <div className="tabs" aria-label="รายละเอียดโปรเจกต์">
            {[
              ["parts", "รายการของ"],
              ["guide", "คู่มือและโค้ด"],
              ["shopping", "ของที่ต้องหาเพิ่ม"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "parts" && (
            <>
              <h2>ตรวจของก่อนลงมือ</h2>
              <p className="muted-text">
                นับชิ้นเดียวครั้งเดียวในโปรเจกต์นี้
                รวมเครื่องมือและอุปกรณ์อัปโหลดแล้ว
              </p>
              <Requirements match={match} />
              <a href="#/inventory" className="secondary">
                แก้ไขหรือยืนยันของในคลัง <Pencil size={16} />
              </a>
            </>
          )}
          {tab === "guide" && (
            <>
              <h2>
                {p.category === "craft"
                  ? "เตรียมแบบและเริ่มสร้าง"
                  : "จุดเชื่อมต่อสำหรับ UNO R3"}
              </h2>
              {p.wiring?.length ? (
                <div className="wiring" aria-label="ผังจุดต่อที่ตรงกับโค้ด">
                  {p.wiring.map((w, i) => (
                    <div key={i}>
                      <span>{w.from}</span>
                      <span className="wire-line" aria-hidden="true">
                        →
                      </span>
                      <span>{w.to}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>
                  {p.category === "craft"
                    ? "เปิดคู่มือต้นทางเพื่อดูภาพขั้นตอนและลิงก์แบบพิมพ์ ตรวจรายการวัสดุก่อนเริ่ม"
                    : "ใช้การเชื่อมต่อ USB กับคอมพิวเตอร์และอุปกรณ์บนบอร์ด ไม่ต้องต่อวงจรภายนอก"}
                </p>
              )}
              <p className="form-hint">
                {p.category === "craft"
                  ? "ภาพบนการ์ดเป็นภาพประกอบแนวคิด ให้ยึดแบบและขั้นตอนจากแหล่งอ้างอิง"
                  : "ผังแสดงความสัมพันธ์ของจุดต่อ ไม่ใช่ตำแหน่งรูบนเบรดบอร์ด ดูภาพวงจรจริงในคู่มือต้นทาง ตรวจคู่ขาปุ่มกดตามข้อมูลผู้ผลิต"}
              </p>
              <ol className="guide-steps">
                {p.steps.map((s, i) => (
                  <li key={i}>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    {s.safety && (
                      <div className="safety-note">
                        <ShieldCheck size={16} />
                        {s.safety}
                      </div>
                    )}
                    <p className="checkpoint">ตรวจสอบ: {s.check}</p>
                  </li>
                ))}
              </ol>
              {p.code && (
                <>
                  {" "}
                  <h2>โค้ด Arduino</h2>
                  <p>
                    UNO R3 (ATmega328P) · Arduino AVR Boards ·
                    ไม่มีไลบรารีเพิ่มเติม
                  </p>
                  <pre>
                    <code>{p.code}</code>
                  </pre>
                  <p className="form-hint">
                    โค้ดตัวอย่างเขียนขึ้นสำหรับ ReBuild
                    ตามหลักการและจุดต่อจากคู่มือ Arduino
                    การใช้งานจริงยังต้องคอมไพล์และทดสอบกับบอร์ด
                  </p>
                </>
              )}{" "}
              <SourceCard project={p} />
            </>
          )}
          {tab === "shopping" && (
            <>
              <h2>หาเฉพาะสิ่งที่ยังต้องใช้</h2>
              <p>
                ลิงก์ด้านล่างเป็นหน้าค้นหา เรายังไม่ได้ตรวจสินค้า ราคา ร้านค้า
                หรือสต็อก ตรวจรุ่นและตัวเลือกให้ตรงก่อนตัดสินใจ
              </p>
              {missing.length === 0 ? (
                <div className="notice">
                  <CheckCircle2 size={20} />
                  รายการที่จำเป็นครบตามข้อมูลที่คุณยืนยันแล้ว
                </div>
              ) : (
                missing.map((r) => (
                  <div className="shopping-item" key={r.requirement.id}>
                    <h3>{r.requirement.label}</h3>
                    <span className="badge">
                      จำเป็น · {statusLabels[r.status]} · ขาด/ต้องตรวจ{" "}
                      {r.missing} หน่วย
                    </span>
                    <p>{r.requirement.why}</p>
                    <p>
                      {r.status === "unknown" || r.status === "incompatible"
                        ? "ตรวจของเดิมและสเปกก่อนหาของเพิ่ม"
                        : ""}
                    </p>
                    <div className="button-row">
                      <a
                        className="secondary"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://shopee.co.th/search?keyword=${encodeURIComponent(r.requirement.label)}`}
                      >
                        ค้นหาสินค้านี้ · Shopee <ExternalLink size={14} />
                      </a>
                      <a
                        className="secondary"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.lazada.co.th/catalog/?q=${encodeURIComponent(r.requirement.label)}`}
                      >
                        ค้นหาสินค้านี้ · Lazada <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </section>
        <aside>
          <div className="panel">
            <h3>
              <Lightbulb size={19} />
              สิ่งที่จะได้เรียนรู้
            </h3>
            <ul className="learning-list">
              {p.learning.map((l) => (
                <li key={l}>
                  <Check size={15} />
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>ก่อนนำไปใช้งาน</h3>
            <p>{p.limitations}</p>
            <p>
              {p.category === "craft"
                ? "ทดลองในพื้นที่โล่ง ผู้เริ่มต้นควรมีผู้ใหญ่ช่วยดูแลการใช้กรรไกรและการทดสอบ"
                : "ใช้ USB เป็นแหล่งจ่ายไฟ ผู้เริ่มต้นควรให้ผู้มีประสบการณ์ตรวจวงจรก่อนต่อไฟ"}
            </p>
          </div>
          <div className="panel">
            <h3>การใช้ชิ้นส่วนทดแทน</h3>
            <p>
              {p.category === "craft"
                ? "ใช้วัสดุเบาและสะอาดตามคู่มือ เปลี่ยนแบบทีละอย่างและบันทึกผล ห้ามเพิ่มชิ้นส่วนแข็งหรือแหลม"
                : "ตัวต้านทานจำกัดกระแส LED ยอมรับ 220 หรือ 330 Ω เฉพาะรายการที่ระบุไว้ ค่า 330 Ω อาจทำให้แสงหรี่ลง อุปกรณ์อื่นต้องตรงตามสเปก"}
            </p>
            <p>
              เมื่อเปลี่ยนของ ให้แก้ไขในคลัง ระบบจะตรวจความพร้อมใหม่ ความเห็นจาก
              AI ไม่ได้อนุมัติการแทนชิ้นส่วน
            </p>
          </div>
          {tab !== "guide" && <SourceCard project={p} />}
        </aside>
      </div>
    </>
  );
}
function BuildView({
  project: p,
  inventory,
  progress,
  onStart,
  update,
  health,
  conflicts,
}: {
  project: Project;
  inventory: InventoryItem[];
  progress?: Progress;
  onStart: () => void;
  update: (p: Progress) => void;
  health: string;
  conflicts: string[];
}) {
  const [measurement, setMeasurement] = useState({
    name: "",
    value: "",
    unit: p.test.unit,
  });
  const match = matchProject(p, inventory);
  if (!progress)
    return (
      <div className="empty-state">
        <h1>{p.title}</h1>
        <button className="primary" onClick={onStart}>
          บันทึกลงโต๊ะทำงาน
        </button>
      </div>
    );
  return (
    <>
      <a className="back-link" href={`#/project/${p.id}`}>
        ← รายละเอียดและคู่มือ
      </a>
      <PageHeading
        eyebrow="YOUR WORKBENCH"
        title={p.title}
        description={`บันทึกแล้ว ${progress.completed.length} จาก ${p.steps.length} ขั้นตอน · ความคืบหน้าไม่ใช่หลักฐานว่าโปรเจกต์ผ่านการทดสอบจริง`}
      />
      <div className={`notice ${match.state === "ready" ? "" : "warning"}`}>
        <AlertCircle size={19} />
        {stateLabels[match.state]} · {match.reason}
        {match.state !== "ready" && (
          <a href="#/inventory">ตรวจของก่อนทำต่อ →</a>
        )}
      </div>
      {conflicts.length > 0 && (
        <div className="notice">
          มีงานอื่นที่อาจใช้ชิ้นส่วนเดียวกัน: {conflicts.join(", ")}{" "}
          ระบบยังไม่ได้จองของแยกงาน ควรทำทีละโปรเจกต์หรือแยกจำนวนให้พอ
        </div>
      )}
      <div className="detail-layout">
        <section className="stack">
          <div
            className="progress-track"
            aria-label={`เสร็จ ${progress.completed.length} จาก ${p.steps.length} ขั้นตอน`}
          >
            <div
              style={{
                width: `${(progress.completed.length / p.steps.length) * 100}%`,
              }}
            />
          </div>
          {p.steps.map((s, i) => (
            <article
              className={`build-step ${progress.completed.includes(i) ? "done" : ""}`}
              key={i}
            >
              <label className="build-step-heading">
                <input
                  type="checkbox"
                  checked={progress.completed.includes(i)}
                  disabled={
                    i > 0 &&
                    match.state !== "ready" &&
                    !progress.completed.includes(i)
                  }
                  onChange={(e) =>
                    update({
                      ...progress,
                      completed: e.target.checked
                        ? [...progress.completed, i]
                        : progress.completed.filter((n) => n !== i),
                    })
                  }
                />
                <span>{String(i + 1).padStart(2, "0")}</span>
                <h2>{s.title}</h2>
              </label>
              <p>{s.text}</p>
              {s.safety && (
                <div className="safety-note">
                  <ShieldCheck size={17} />
                  {s.safety}
                </div>
              )}
              <p className="checkpoint">ตรวจสอบ: {s.check}</p>
            </article>
          ))}
          <div className="panel">
            <h2>บันทึกสิ่งที่เรียนรู้</h2>
            <label>
              ปัญหา สิ่งที่ลอง และไอเดียต่อยอด
              <textarea
                rows={5}
                maxLength={10000}
                value={progress.notes}
                placeholder="ลองอะไรไปแล้ว สังเกตเห็นอะไร..."
                onChange={(e) => update({ ...progress, notes: e.target.value })}
              />
            </label>
            <p className="form-hint">บันทึกอัตโนมัติในเบราว์เซอร์นี้</p>
          </div>
          <div className="panel">
            <h2>ผลการทดสอบของคุณ</h2>
            <p>{p.test.instruction}</p>
            <p className="form-hint">
              กรอกค่าที่คุณวัดเอง ระบบไม่สร้างผลการทดลองให้
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                update({
                  ...progress,
                  measurements: [...progress.measurements, measurement].slice(
                    0,
                    50,
                  ),
                });
                setMeasurement({ ...measurement, name: "", value: "" });
              }}
            >
              <div className="form-columns">
                <label>
                  สิ่งที่วัด
                  <input
                    required
                    maxLength={100}
                    value={measurement.name}
                    onChange={(e) =>
                      setMeasurement({ ...measurement, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  ค่าที่ได้
                  <input
                    required
                    maxLength={100}
                    value={measurement.value}
                    onChange={(e) =>
                      setMeasurement({ ...measurement, value: e.target.value })
                    }
                  />
                </label>
                <label>
                  หน่วย
                  <input
                    required
                    maxLength={40}
                    value={measurement.unit}
                    onChange={(e) =>
                      setMeasurement({ ...measurement, unit: e.target.value })
                    }
                  />
                </label>
              </div>
              <button
                className="secondary"
                type="submit"
                disabled={progress.measurements.length >= 50}
              >
                เพิ่มผลการวัด <Plus size={17} />
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
                  aria-label={`ลบผล ${m.name}`}
                  onClick={() => {
                    if (confirm("ลบผลการวัดนี้?"))
                      update({
                        ...progress,
                        measurements: progress.measurements.filter(
                          (_, n) => n !== i,
                        ),
                      });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <details className="panel">
            <summary>บันทึกชิ้นส่วนทดแทนและการตั้งค่า</summary>
            <p>
              บันทึกนี้ไม่เปลี่ยนข้อกำหนดของคู่มือ
              แก้ของในคลังเพื่อตรวจสเปกใหม่ด้วย
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
                  placeholder="เช่น ใช้ 330 Ω ตามทางเลือกในคู่มือ"
                />
              </label>
            ))}
          </details>
        </section>
        <aside>
          <AIHelp
            project={p}
            inventory={inventory}
            step={p.steps.findIndex((_, i) => !progress.completed.includes(i))}
            health={health}
          />
          <SourceCard project={p} />
          <a className="secondary" href={`#/project/${p.id}`}>
            ดูคู่มือและขั้นตอน <ArrowUpRight size={17} />
          </a>
        </aside>
      </div>
    </>
  );
}
function AIHelp({
  project,
  inventory,
  step,
  health,
}: {
  project: Project;
  inventory: InventoryItem[];
  step: number;
  health: string;
}) {
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
        {
          mode: "help",
          text,
          inventory,
          projectId: project.id,
          step: Math.max(0, step),
        },
        controller.current.signal,
      );
      setAnswer(result.reply);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "ยกเลิกแล้ว"
          : e instanceof Error
            ? e.message
            : "บริการไม่พร้อม",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel ai-panel">
      <h3>
        <Sparkles size={20} />
        เพื่อนช่วยคิด
      </h3>
      <p>ถามโดยอ้างอิงของในคลัง คู่มือ และขั้นตอนที่กำลังทำ</p>
      {health !== "online" && (
        <div className="notice">
          AI ยังไม่เชื่อมต่อ ใช้จุดตรวจสอบและคู่มือต้นทางได้ระหว่างนี้
        </div>
      )}
      <form className="stack" onSubmit={(e) => void send(e)}>
        <label>
          ติดตรงไหนอยู่?
          <textarea
            rows={4}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="เช่น อัปโหลดได้แล้ว แต่ LED ไม่ติด..."
          />
        </label>
        <p className="form-hint">
          การส่งคำถามจะส่งคลังและบริบทโปรเจกต์ให้บริการ AI
          ตามคำอธิบายความเป็นส่วนตัว
        </p>
        <button
          className="primary"
          disabled={health !== "online" || busy || !text.trim()}
        >
          {busy ? (
            <LoaderCircle className="spinner" size={17} />
          ) : (
            <Sparkles size={17} />
          )}
          ถามผู้ช่วย
        </button>
        {busy && (
          <button
            type="button"
            className="secondary"
            onClick={() => controller.current?.abort()}
          >
            ยกเลิก
          </button>
        )}
      </form>
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
      <p className="form-hint">
        คำแนะนำอาจคลาดเคลื่อน และไม่อนุมัติการเปลี่ยนชิ้นส่วนโดยอัตโนมัติ
      </p>
    </div>
  );
}
