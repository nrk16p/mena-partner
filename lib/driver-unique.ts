import type { Collection, Document, Filter } from "mongodb"

/**
 * ชื่อพนักงานขับรถห้ามซ้ำ (ผู้ใช้สั่ง 2026-11-23) — ชื่อ+นามสกุลเดียวกัน ไม่สนตัวพิมพ์/ช่องว่างซ้อน
 * ไม่นับคำนำหน้า (นาย/นาง) เพราะคนเดียวกันอาจถูกคีย์คำนำหน้าต่างกัน
 */
const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const norm = (v?: string | null) => String(v ?? "").trim().replace(/\s+/g, " ")
const exact = (v: string) => new RegExp(`^\\s*${esc(v).replace(/ /g, "\\s+")}\\s*$`, "i")

export type DuplicateDriver = { firstName?: string; lastName?: string; staffCode?: string }

/** หาคนที่ชื่อซ้ำ — except = เงื่อนไขกันตัวเองออก เช่น { _id: { $ne: id } } */
export async function findDuplicateDriver(
  col: Collection<Document>, firstName?: string | null, lastName?: string | null, except: Filter<Document> = {},
): Promise<DuplicateDriver | null> {
  const f = norm(firstName), l = norm(lastName)
  if (!f || !l) return null
  return (await col.findOne(
    { firstName: exact(f), lastName: exact(l), ...except },
    { projection: { firstName: 1, lastName: 1, staffCode: 1 } },
  )) as DuplicateDriver | null
}

export const duplicateDriverMessage = (d: DuplicateDriver) =>
  `ชื่อ ${d.firstName ?? ""} ${d.lastName ?? ""} มีในระบบแล้ว${d.staffCode ? ` (รหัส ${d.staffCode})` : ""} ชื่อพนักงานขับรถห้ามซ้ำ`
