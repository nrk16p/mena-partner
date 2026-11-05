import "server-only"
import { ObjectId, type Db } from "mongodb"
import { formatBankAccount, hasBankAccount, type BankAccount } from "@/lib/bank-account"
import { normPlate } from "@/lib/deal-vehicles"

const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const ci = (v: string) => ({ $regex: `^${esc(v.trim())}$`, $options: "i" })

/**
 * บัญชีรับเงินของเซลล์ — sales_people (กรอกเอง) ก่อน ถ้าว่างแต่มาจากใบสมัครนายหน้า ใช้บัญชีในใบสมัคร
 * คืน "" ถ้าไม่มีทั้งคู่ (หน้า Excel/PDF จะเว้นไว้ให้การเงินเติม)
 */
export async function bankAccountOfSales(db: Db, who: { email?: string; name?: string }): Promise<string> {
  const email = (who.email ?? "").trim(), name = (who.name ?? "").trim()
  const or = [...(email ? [{ email: ci(email) }] : []), ...(name ? [{ name: ci(name) }] : [])]
  if (!or.length) return ""
  const sp = await db.collection("sales_people").findOne({ $or: or }, { projection: { bankName: 1, bankAccountNo: 1, bankAccountName: 1, brokerApplicationId: 1 } })
  if (!sp) return ""
  if (hasBankAccount(sp as BankAccount)) return formatBankAccount(sp as BankAccount)
  const appId = String(sp.brokerApplicationId ?? "")
  if (!ObjectId.isValid(appId)) return ""
  const app = await db.collection("broker_applications").findOne({ _id: new ObjectId(appId) }, { projection: { bankName: 1, bankAccountNo: 1, bankAccountName: 1 } })
  return formatBankAccount(app as BankAccount | null)
}

/** รหัสสัญญาต่อทะเบียน — จาก contracts (ทะเบียนเดียวกันหลายสัญญา = เอาสัญญาล่าสุด) */
export async function contractCodesByPlate(db: Db, plates: string[]): Promise<Map<string, string>> {
  const want = new Set(plates.map(normPlate).filter(Boolean))
  const out = new Map<string, string>()
  if (!want.size) return out
  const rows = await db.collection("contracts")
    .find({}, { projection: { contractCode: 1, licensePlate: 1, contractDate: 1, createdAt: 1 }, maxTimeMS: 15000 })
    .limit(5000).toArray()
  const best = new Map<string, { code: string; at: string }>()
  for (const r of rows) {
    const k = normPlate(String(r.licensePlate ?? ""))
    if (!want.has(k) || !r.contractCode) continue
    const at = String(r.contractDate ?? r.createdAt ?? "")
    const cur = best.get(k)
    if (!cur || at > cur.at) best.set(k, { code: String(r.contractCode), at })
  }
  for (const [k, v] of best) out.set(k, v.code)
  return out
}

export const contractCodeFor = (map: Map<string, string>, plate: string) => map.get(normPlate(plate)) ?? ""

/** บัญชีรับเงินของทุกคนในคราวเดียว (หน้าค่าคอม) — คืนฟังก์ชันหาโดย email ก่อน แล้วชื่อ */
export async function bankAccountIndex(db: Db): Promise<(who: { email?: string; name?: string }) => string> {
  const people = await db.collection("sales_people")
    .find({}, { projection: { name: 1, email: 1, bankName: 1, bankAccountNo: 1, bankAccountName: 1, brokerApplicationId: 1 } }).toArray()
  const appIds = people.map((r) => String(r.brokerApplicationId ?? "")).filter((id) => ObjectId.isValid(id))
  const apps = appIds.length
    ? await db.collection("broker_applications").find({ _id: { $in: appIds.map((id) => new ObjectId(id)) } }, { projection: { bankName: 1, bankAccountNo: 1, bankAccountName: 1 } }).toArray()
    : []
  const appBank = new Map(apps.map((a) => [String(a._id), a as BankAccount]))
  const byEmail = new Map<string, string>(), byName = new Map<string, string>()
  for (const r of people) {
    const own = hasBankAccount(r as BankAccount) ? formatBankAccount(r as BankAccount) : formatBankAccount(appBank.get(String(r.brokerApplicationId ?? "")))
    if (!own) continue
    const e = String(r.email ?? "").trim().toLowerCase(), n = String(r.name ?? "").trim().toLowerCase()
    if (e) byEmail.set(e, own)
    if (n) byName.set(n, own)
  }
  return (who) => byEmail.get((who.email ?? "").trim().toLowerCase()) ?? byName.get((who.name ?? "").trim().toLowerCase()) ?? ""
}

/** กรอกบัญชีรับเงินจากหน้าค่าคอม — มีชื่อ/อีเมลใน sales_people อยู่แล้วก็อัปเดต ไม่มีก็สร้างแถวให้ (จะได้ไม่ต้องไปหน้าทีมขายก่อน) */
export async function upsertSalesBank(
  db: Db, who: { email?: string; name?: string }, bank: BankAccount, actor: string,
): Promise<{ created: boolean }> {
  const email = (who.email ?? "").trim(), name = (who.name ?? "").trim()
  if (!email && !name) throw new Error("ไม่รู้ว่าเป็นเซลล์คนไหน")
  const or = [...(email ? [{ email: ci(email) }] : []), ...(name ? [{ name: ci(name) }] : [])]
  const set = {
    bankName: String(bank.bankName ?? "").trim(), bankAccountNo: String(bank.bankAccountNo ?? "").replace(/\D/g, ""),
    bankAccountName: String(bank.bankAccountName ?? "").trim(), updatedAt: new Date().toISOString(), updatedBy: actor,
  }
  const cur = await db.collection("sales_people").findOne({ $or: or }, { projection: { _id: 1 } })
  if (cur) { await db.collection("sales_people").updateOne({ _id: cur._id }, { $set: set }); return { created: false } }
  await db.collection("sales_people").insertOne({ name: name || email, email: email.toLowerCase(), phone: "", ...set, createdAt: set.updatedAt, createdBy: actor })
  return { created: true }
}
