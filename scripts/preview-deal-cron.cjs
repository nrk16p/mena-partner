/**
 * พรีวิวผลของงานรายคืน — ถ้าเปิด cron วันนี้ ดีลไหนจะถูกปิด (กฎเดิม vs กฎใหม่)
 * อ่านอย่างเดียว ไม่เขียนอะไรลง DB
 *
 *   node scripts/preview-deal-cron.cjs
 *
 * ใช้กติกาชุดเดียวกับ lib/deal-cron.ts (AUTO_CLOSE_DAYS 30 · ยกเว้น CONTRACT_SIGNED/DELIVERED
 * และดีลที่พักติดตามไว้ยังไม่ถึงวันนัด) — ถ้าแก้กติกาในโค้ดหลัก อย่าลืมแก้ที่นี่ด้วย
 */
const path = require("path")
const root = path.join(__dirname, "..")
require(path.join(root, "node_modules/dotenv/lib/main.js")).config({ path: path.join(root, ".env.local") })
const { MongoClient } = require(path.join(root, "node_modules/mongodb"))

const AUTO_CLOSE_DAYS = 30
const DAYS_TO_COMPLETE = 90
const EXEMPT_NEW = new Set(["CONTRACT_SIGNED", "DELIVERED"])
const LABEL = {
  LEAD: "ผู้สนใจ", QUALIFIED: "ผ่านคุณสมบัติ", QUOTED: "เสนอราคาแล้ว", VIEWING_SCHEDULED: "นัดดูรถ",
  RESERVED: "วางจองแล้ว", TRAINING: "ฝึกงาน", CONTRACT_SCHEDULED: "นัดเซ็นสัญญา",
  CONTRACT_SIGNED: "เซ็นสัญญาแล้ว รอส่งมอบ", DELIVERED: "ส่งมอบรถสำเร็จ", ON_HOLD: "พักติดตาม",
}

;(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI
  if (!uri) throw new Error("ไม่พบ MONGODB_URI ใน .env.local")
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGO_DB || "mena_partner")
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const rows = await db.collection("quotations")
    .find({ stage: { $nin: ["CLOSED_LOST", "COMPLETED_90D"] } })
    .project({ quotationNo: 1, stage: 1, stageBeforeHold: 1, nextFollowUpDate: 1, deliveredAt: 1, lastActivityAt: 1, updatedAt: 1, createdAt: 1 })
    .toArray()

  const days = (iso) => (iso ? Math.floor((now - new Date(iso)) / 86400000) : Infinity)
  const oldClose = [], newClose = [], completed = []
  const saved = {}

  for (const d of rows) {
    const stage = String(d.stage ?? "")
    const quiet = days(String(d.lastActivityAt ?? d.updatedAt ?? d.createdAt ?? ""))
    const complete = stage === "DELIVERED" && days(String(d.deliveredAt ?? "")) >= DAYS_TO_COMPLETE
    if (complete) { completed.push(d.quotationNo); continue }

    const waitingOnPlan = stage === "ON_HOLD" && !!d.nextFollowUpDate && String(d.nextFollowUpDate) > today
    const quietEnough = quiet >= AUTO_CLOSE_DAYS
    if (!quietEnough) continue

    if (stage !== "DELIVERED") oldClose.push({ ...d, stage, quiet })
    if (!EXEMPT_NEW.has(stage) && !waitingOnPlan) {
      newClose.push({ ...d, stage, quiet })
    } else if (stage !== "DELIVERED") {
      const k = waitingOnPlan ? "พักไว้ ยังไม่ถึงวันนัด" : (LABEL[stage] ?? stage)
      saved[k] = (saved[k] ?? 0) + 1
    }
  }

  const groupBy = (list) => list.reduce((m, r) => {
    const k = r.stage === "ON_HOLD" ? `พักติดตาม (เดิม ${LABEL[r.stageBeforeHold] ?? "?"})` : (LABEL[r.stage] ?? r.stage)
    m[k] = (m[k] ?? 0) + 1
    return m
  }, {})

  console.log(`ดีลที่ยังเดินอยู่ ${rows.length} ใบ · วันนี้ ${today}\n`)
  console.log(`กฎเดิม → ปิดอัตโนมัติ ${oldClose.length} ใบ`, groupBy(oldClose))
  console.log(`กฎใหม่ → ปิดอัตโนมัติ ${newClose.length} ใบ`, groupBy(newClose))
  console.log(`รอดจากการถูกปิด ${oldClose.length - newClose.length} ใบ:`, saved)
  console.log(`ขยับเป็น "ครบ 90 วันแรก" ${completed.length} ใบ`)
  if (newClose.length) {
    console.log("\nรายการที่จะถูกปิด (10 ใบแรก):")
    for (const r of newClose.slice(0, 10)) console.log(`  ${r.quotationNo}  ${LABEL[r.stage] ?? r.stage}  เงียบ ${r.quiet} วัน`)
  }
  await client.close()
})().catch((e) => { console.error(e.message); process.exit(1) })
