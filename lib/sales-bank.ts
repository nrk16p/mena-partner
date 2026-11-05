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
