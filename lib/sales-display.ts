import type { Db } from "mongodb"

/** ชื่อผู้ขายที่เก็บมาเป็นอีเมล (ใบเก่า / ล็อกอินที่ไม่มีชื่อ) → ต้องแปลงเป็นชื่อจริงก่อนขึ้นหน้า PDF */
export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

/** เดาชื่อจากอีเมลเมื่อหาในระบบไม่เจอ: "somchai.j@x.com" → "Somchai J" (ดีกว่าโชว์อีเมลเต็มในเอกสารลูกค้า) */
export function nameFromEmail(email: string): string {
  const local = email.trim().split("@")[0] ?? ""
  return local.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
}

/**
 * ชื่อจริงของเซลล์สำหรับเอกสาร — ลำดับหา: sales_people.email → app_users.name → เดาจากอีเมล
 * ชื่อที่ไม่ใช่อีเมลคืนตามเดิม (ไม่แตะ DB)
 */
export async function salesDisplayName(db: Db, salesName: string, salesEmail?: string): Promise<string> {
  const name = (salesName ?? "").trim()
  if (name && !looksLikeEmail(name)) return name
  const email = (name || salesEmail || "").trim().toLowerCase()
  if (!email) return name
  const rx = { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  const sp = await db.collection("sales_people").findOne({ email: rx }, { projection: { name: 1 } })
  const spName = String(sp?.name ?? "").trim()
  if (spName && !looksLikeEmail(spName)) return spName
  const u = await db.collection("app_users").findOne({ email: rx }, { projection: { name: 1 } })
  const uName = String(u?.name ?? "").trim()
  if (uName && !looksLikeEmail(uName)) return uName
  return nameFromEmail(email)
}
