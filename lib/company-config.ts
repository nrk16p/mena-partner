import type { Db } from "mongodb"

/**
 * ข้อมูลบริษัท + ผู้ลงนาม ที่ใช้พิมพ์บนสัญญาทุกชนิด — แก้ผ่านหน้า master (/admin/company)
 * เดิมฝังตายในโค้ด 2 ที่ (หน้าพรีวิว/พิมพ์ กับตัวสร้าง PDF) เปลี่ยนคนเซ็นทีต้องแก้โค้ด+deploy
 * ค่าเริ่มต้นด้านล่าง = ค่าที่ใช้มาก่อนหน้านี้ ถ้ายังไม่เคยบันทึกใน DB จะใช้ชุดนี้
 */

export interface CompanyConfig {
  name: string
  regNo: string
  address: string
  sellerSignatories: string[]   // ผู้ลงนามฝ่ายผู้ขาย (2 คน)
  witnesses: string[]           // พยาน (2 คน)
  updatedAt?: string
  updatedBy?: string
}

export const COMPANY_DEFAULT: CompanyConfig = {
  name: "บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)",
  regNo: "0195536000089",
  address: "เลขที่ 280/8 หมู่ที่ 9 ตำบลทับกวาง อำเภอแก่งคอย จังหวัดสระบุรี",
  sellerSignatories: ["นางสุวรรณา ขจรวุฒิเดช", "นางสาวพัชรีรัตน์ ขจรวุฒิเดชภัทร์"],
  witnesses: ["นางสาวนัชภัค ขจรวุฒิเดช", "นางสาวธัญรดี ตะกิ่นนอก"],
}

const COLL = "company_config"
const ID = "default"

const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback)
/** ผู้ลงนาม/พยาน: เก็บ 2 ช่องเสมอ (ช่องว่าง = ไม่พิมพ์ชื่อในวงเล็บ แต่ยังมีเส้นให้เซ็น) */
const pair = (v: unknown, fallback: string[]) => {
  const arr = Array.isArray(v) ? v.map((x) => String(x ?? "").trim()) : []
  return [arr[0] ?? fallback[0] ?? "", arr[1] ?? fallback[1] ?? ""]
}

export function normalizeCompany(raw: Partial<CompanyConfig> | null | undefined): CompanyConfig {
  return {
    name: str(raw?.name, COMPANY_DEFAULT.name),
    regNo: str(raw?.regNo, COMPANY_DEFAULT.regNo),
    address: str(raw?.address, COMPANY_DEFAULT.address),
    sellerSignatories: pair(raw?.sellerSignatories, COMPANY_DEFAULT.sellerSignatories),
    witnesses: pair(raw?.witnesses, COMPANY_DEFAULT.witnesses),
    updatedAt: raw?.updatedAt,
    updatedBy: raw?.updatedBy,
  }
}

export async function getCompanyConfig(db: Db): Promise<CompanyConfig> {
  const doc = await db.collection(COLL).findOne({ _id: ID as unknown as never })
  return normalizeCompany(doc as Partial<CompanyConfig> | null)
}

export async function saveCompanyConfig(db: Db, raw: Partial<CompanyConfig>, by: string): Promise<CompanyConfig> {
  const next = { ...normalizeCompany(raw), updatedAt: new Date().toISOString(), updatedBy: by }
  await db.collection(COLL).updateOne({ _id: ID as unknown as never }, { $set: next }, { upsert: true })
  return next
}
