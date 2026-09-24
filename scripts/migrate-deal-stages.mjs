/**
 * ย้ายดีลเดิม (quotations) เข้าสู่ pipeline 10 สถานะ
 *
 * mapping ที่ผู้ใช้เคาะ:
 *   lead → LEAD · quoted → QUOTED · booked → RESERVED · won → CONTRACT_SIGNED · lost → CLOSED_LOST
 *   ดีลที่ lost: เดา "หลุดที่ขั้นไหน" จาก timeline ย้อนหลัง (สถานะก่อนถูกปิด) ไม่ได้ก็ LEAD
 *
 * เติมให้ทุกใบ: stage, stageEnteredAt, lastActivityAt และเขียนประวัติตั้งต้นลง deal_stage_history
 * ของเดิม (status) ไม่ลบ — หน้าเก่ายังอ่านได้จนกว่าจะเปลี่ยนครบ
 *
 * ใช้: node scripts/migrate-deal-stages.mjs [--apply]
 */
import { config } from "dotenv"
import { MongoClient } from "mongodb"

config({ path: ".env.local", quiet: true })

const apply = process.argv.includes("--apply")
const client = await MongoClient.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
const db = client.db(process.env.MONGO_DB ?? "mena_partner")

const MAP = { lead: "LEAD", quoted: "QUOTED", booked: "RESERVED", won: "CONTRACT_SIGNED", lost: "CLOSED_LOST" }
/** ข้อความในไทม์ไลน์ตอนเปลี่ยนสถานะเดิม → ขั้นใหม่ (ใช้เดาว่าหลุดตอนอยู่ขั้นไหน) */
const LABEL_TO_STAGE = { "สนใจ": "LEAD", "เสนอราคาแล้ว": "QUOTED", "วางจอง": "RESERVED", "ปิดการขาย": "CONTRACT_SIGNED" }

const deals = await db.collection("quotations").find({}).toArray()
const plan = []

for (const d of deals) {
  if (d.stage) continue                       // ย้ายแล้ว
  const stage = MAP[d.status] ?? "LEAD"
  const row = { _id: d._id, no: d.quotationNo, from: d.status, stage }

  if (stage === "CLOSED_LOST") {
    // ไล่ไทม์ไลน์จากท้ายมาหน้า หาสถานะสุดท้ายก่อนถูกปิด
    let lost = "LEAD"
    for (const ev of [...(d.timeline ?? [])].reverse()) {
      const hit = Object.entries(LABEL_TO_STAGE).find(([label]) => String(ev.action ?? "").includes(label))
      if (hit && hit[1] !== "CLOSED_LOST") { lost = hit[1]; break }
    }
    row.lostAtStage = lost
  }
  plan.push(row)
}

const byStage = plan.reduce((acc, r) => ({ ...acc, [r.stage]: (acc[r.stage] ?? 0) + 1 }), {})
console.log("ดีลทั้งหมด", deals.length, "| ต้องย้าย", plan.length)
console.log("ผลที่จะได้:", JSON.stringify(byStage, null, 1))
const lostBreak = plan.filter((r) => r.lostAtStage).reduce((a, r) => ({ ...a, [r.lostAtStage]: (a[r.lostAtStage] ?? 0) + 1 }), {})
if (Object.keys(lostBreak).length) console.log("ดีลที่ปิดไป หลุดที่ขั้น:", JSON.stringify(lostBreak))

if (apply && plan.length) {
  const now = new Date().toISOString()
  const history = []
  for (const r of plan) {
    const d = deals.find((x) => String(x._id) === String(r._id))
    const at = d.updatedAt ?? d.createdAt ?? now
    const $set = {
      stage: r.stage,
      stageEnteredAt: at,
      lastActivityAt: at,
      ...(r.lostAtStage ? { lostAtStage: r.lostAtStage, lostAt: at } : {}),
    }
    await db.collection("quotations").updateOne({ _id: r._id }, { $set })
    history.push({
      dealId: String(r._id), fromStage: null, toStage: r.stage,
      changedBy: "migration", changedAt: at, isAutomatic: true,
      note: `ย้ายจากสถานะเดิม "${r.from}"`,
    })
  }
  if (history.length) await db.collection("deal_stage_history").insertMany(history)
  await db.collection("deal_stage_history").createIndex({ dealId: 1, changedAt: 1 })
  await db.collection("quotations").createIndex({ stage: 1, lastActivityAt: 1 })
  console.log("ย้ายแล้ว", plan.length, "ใบ · เขียนประวัติ", history.length, "แถว · สร้าง index แล้ว")
} else if (!apply) {
  console.log("dry-run (ใส่ --apply เพื่อเขียนจริง)")
}

await client.close()
