import { useState } from "react";
import { useLanguage, unitText } from "../i18n";
import type { InventoryItem } from "../domain/schema";
import type { InventoryFilters } from "../domain/inventory-tools";
import { Modal } from "./Modal";

export function InventoryFilterControls({
  value,
  change,
}: {
  value: InventoryFilters;
  change: (next: InventoryFilters) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="form-columns inventory-filters">
      <label>
        {t("กรองตามสภาพ", "Filter condition")}
        <select
          value={value.condition}
          onChange={(e) =>
            change({
              ...value,
              condition: e.target.value as InventoryFilters["condition"],
            })
          }
        >
          <option value="all">{t("ทุกสภาพ", "All conditions")}</option>
          <option value="usable">{t("ใช้งานได้", "Usable")}</option>
          <option value="unknown">{t("ยังไม่ตรวจ", "Unchecked")}</option>
          <option value="damaged">{t("ชำรุด", "Damaged")}</option>
        </select>
      </label>
      <label>
        {t("กรองประเภท", "Filter type")}
        <select
          value={value.kind}
          onChange={(e) =>
            change({
              ...value,
              kind: e.target.value as InventoryFilters["kind"],
            })
          }
        >
          <option value="all">{t("ทุกประเภท", "All types")}</option>
          <option value="tool">{t("เครื่องมือ", "Tools")}</option>
          <option value="material">{t("วัสดุ", "Materials")}</option>
          <option value="component">{t("ชิ้นส่วน", "Components")}</option>
          <option value="custom">{t("ของที่เพิ่มเอง", "Custom items")}</option>
        </select>
      </label>
      <label>
        {t("เรียงรายการ", "Sort items")}
        <select
          value={value.sort}
          onChange={(e) =>
            change({
              ...value,
              sort: e.target.value as InventoryFilters["sort"],
            })
          }
        >
          <option value="saved">{t("ลำดับที่บันทึก", "Saved order")}</option>
          <option value="name">{t("ชื่อ", "Name")}</option>
          <option value="quantity">
            {t("จำนวนมากก่อน", "Largest quantity")}
          </option>
        </select>
      </label>
    </div>
  );
}

export function UseMaterial({
  item,
  close,
  consume,
}: {
  item: InventoryItem;
  close: () => void;
  consume: (quantity: number) => string | void;
}) {
  const { t, language } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  return (
    <Modal title={t("บันทึกการใช้วัสดุ", "Record material use")} close={close}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const message = consume(quantity);
          if (message) setError(message);
        }}
      >
        <p>
          {item.label} · {t("คงเหลือ", "Available")}: {item.quantity}{" "}
          {unitText(item.unit, language)}
        </p>
        <label>
          {t("จำนวนที่ใช้ไป", "Quantity used")}
          <input
            required
            type="number"
            min={1}
            max={item.quantity}
            step={1}
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <p>
          {t(
            "ตรวจจำนวนก่อนยืนยัน ระบบจะลดจำนวนในคลัง ถ้าใช้หมดจะนำรายการนี้ออก ไม่หักวัสดุอัตโนมัติเมื่อบันทึกโปรเจกต์",
            "Check before confirming. This reduces inventory and removes the item if used up. Saving a project never consumes materials automatically.",
          )}
        </p>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="secondary" type="button" onClick={close}>
            {t("ยกเลิก", "Cancel")}
          </button>
          <button className="primary">
            {t("ยืนยันจำนวนที่ใช้", "Confirm material use")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
