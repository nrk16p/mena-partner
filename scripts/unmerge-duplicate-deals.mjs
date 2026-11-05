// ย้อนกลับการรวบใบซ้ำ (scripts/merge-duplicate-deals.mjs) — ค่าเริ่มต้น = พรีวิว, ใส่ --execute ถึงเขียนจริง
// --no=QT-2608-063,QT-2608-058  ย้อนเฉพาะใบเก่าที่ระบุ · --into=QT-2608-064 ย้อนทุกใบที่ถูกรวบเข้าใบนี้ · ไม่ใส่ = ย้อนทั้งหมด
// ทำอะไร: 1) คืนใบเก่าจาก quotations_merged กลับ quotations (ตัด mergedInto/mergedIntoNo/mergedAt)
//         2) ใบที่ยึด: ถอด timeline ที่มี from / by system@merge, รถที่ addedBy merge:<no>, สลิป+ไฟล์แนบที่มาจากใบเก่า, mergedFrom
//            ค่าที่ถูก "เติม" (เงินจอง) ถอดเฉพาะเมื่อเท่ากับของใบเก่า (ใบที่ยึดเดิมไม่มี)
//         3) deal_stage_history: dealId กลับเป็นของใบเก่า (ใช้ mergedFromDealId)
import { MongoClient, ObjectId } from "mongodb"
import fs from "node:fs"
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^(\w+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "") }
const execute = process.argv.includes("--execute")
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? "").slice(k.length + 3)
const onlyNos = arg("no").split(",").map((s) => s.trim()).filter(Boolean)
const onlyInto = arg("into").trim()

const c = await MongoClient.connect(process.env.MONGO_URI, { maxPoolSize: 2 })
const db = c.db(process.env.MONGO_DB ?? "mena_partner")
const Q = db.collection("quotations"), M = db.collection("quotations_merged"), H = db.collection("deal_stage_history")

const filter = onlyNos.length ? { quotationNo: { $in: onlyNos } } : onlyInto ? { mergedIntoNo: onlyInto } : {}
const olds = await M.find(filter, { maxTimeMS: 30000 }).toArray()
console.log(`${execute ? "ย้อนจริง" : "พรีวิว"}: ใบที่ถูกรวบไว้ ${olds.length} ใบ`)
if (!olds.length) { await c.close(); process.exit(0) }

// จัดกลุ่มตามใบที่ยึด
const byKeep = new Map()
for (const o of olds) { const k = String(o.mergedInto); if (!byKeep.has(k)) byKeep.set(k, []); byKeep.get(k).push(o) }
let restored = 0
for (const [keepId, group] of byKeep) {
  const keep = ObjectId.isValid(keepId) ? await Q.findOne({ _id: new ObjectId(keepId) }, { maxTimeMS: 30000 }) : null
  const nos = new Set(group.map((o) => o.quotationNo))
  const ids = new Set(group.map((o) => String(o._id)))
  console.log(`\n▶ ใบที่ยึด ${keep?.quotationNo ?? keepId} (${keep?.customerName ?? "?"}) ← คืน ${group.map((o) => o.quotationNo || "lead").join(", ")}`)
  if (!keep) { console.log("   ⚠ หาใบที่ยึดไม่เจอ จะคืนใบเก่าอย่างเดียว") }

  let set = {}, unset = {}
  if (keep) {
    // ถอดทุกรายการที่สคริปต์รวบใส่ไว้: มี key from (รวม lead เปล่าที่ from = undefined) หรือ by system@merge (ไม่มีใครอื่นเขียน by นี้)
    const timeline = (keep.timeline ?? []).filter((t) => !("from" in t) && t.by !== "system@merge")
    const vehicles = (keep.vehicles ?? []).filter((v) => !(String(v.addedBy ?? "").startsWith("merge:") && nos.has(String(v.addedBy).slice(6))))
    const oldSlips = new Set(group.flatMap((o) => [...(o.depositSlips ?? []), ...(o.depositSlipUrl ? [o.depositSlipUrl] : [])]))
    const depositSlips = (keep.depositSlips ?? []).filter((s) => !oldSlips.has(s) || s === keep.depositSlipUrl)
    const oldAtt = new Set(group.flatMap((o) => (o.attachments ?? []).map((a) => a.url)))
    const attachments = (keep.attachments ?? []).filter((a) => !oldAtt.has(a.url))
    const mergedFrom = (keep.mergedFrom ?? []).filter((m) => !ids.has(String(m._id)))
    set = { timeline, vehicles, depositSlips, attachments, updatedAt: new Date().toISOString() }
    if (mergedFrom.length) set.mergedFrom = mergedFrom; else unset.mergedFrom = ""
    // เงินจองที่ถูกเติมจากใบเก่า (ใบที่ยึดเดิมไม่มี) — ถอดถ้าเท่ากับของใบเก่าพอดี
    if (keep.depositAmount > 0 && group.some((o) => o.depositAmount === keep.depositAmount) && (keep.timeline ?? []).some((t) => t.from && /เงินจอง|มัดจำ|จอง/.test(String(t.action ?? "")))) {
      unset.depositAmount = ""; unset.reservationAmount = ""
    }
    console.log(`   timeline ${(keep.timeline ?? []).length} → ${timeline.length} · รถเสนอ ${(keep.vehicles ?? []).length} → ${vehicles.length} · สลิป ${(keep.depositSlips ?? []).length} → ${depositSlips.length} · ถอด ${Object.keys(unset).join(",") || "-"}`)
  }
  if (!execute) continue

  if (keep) await Q.updateOne({ _id: keep._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) })
  for (const o of group) {
    const { mergedInto, mergedIntoNo, mergedAt, ...orig } = o
    await Q.insertOne(orig)
    await H.updateMany({ mergedFromDealId: String(o._id) }, { $set: { dealId: String(o._id) }, $unset: { mergedFromDealId: "" } })
    await M.deleteOne({ _id: o._id })
    restored++
  }
}
console.log(`\nสรุป: ${execute ? `คืนใบเก่า ${restored} ใบ กลับ quotations แล้ว` : `จะคืน ${olds.length} ใบ · ยังไม่เขียนอะไร (ใส่ --execute เพื่อทำจริง)`}`)
await c.close()
