// รวบใบเสนอราคาซ้ำของลูกค้าคนเดียวกันให้เหลือใบเดียว (ยึดใบล่าสุด) — ค่าเริ่มต้น = พรีวิว, ใส่ --execute ถึงเขียนจริง
// จับคู่ลูกค้าด้วย customerId > เบอร์โทร (ตัวเลขล้วน ≥ 9 หลัก) > ชื่อ (ตัดช่องว่าง/ตัวพิมพ์)
// ใบเก่า: ย้าย timeline + สลิป + ไฟล์แนบ + รถ (เป็นคันเสนอ) เข้าใบล่าสุด แล้วย้ายเอกสารไป quotations_merged (ไม่ลบทิ้ง กู้ได้)
// ข้ามกลุ่มที่เสี่ยง: ใบเก่าปิดการขาย/มีทำจ่ายค่าคอมแล้ว แต่ใบล่าสุดยังไม่ถึง — รายงานให้คนตัดสินเอง
import { MongoClient } from "mongodb"
import fs from "node:fs"
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^(\w+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "") }
const execute = process.argv.includes("--execute")
const onlyName = (process.argv.find((a) => a.startsWith("--name=")) ?? "").slice(7)

const normPhone = (p) => { const d = String(p ?? "").replace(/\D/g, ""); return d.startsWith("66") && d.length === 11 ? "0" + d.slice(2) : d }
const normName = (n) => String(n ?? "").trim().replace(/\s+/g, " ").toLowerCase()
const normPlate = (p) => String(p ?? "").replace(/[\s.\-]/g, "").toLowerCase()
const WON = new Set(["CONTRACT_SIGNED", "DELIVERED", "COMPLETED_90D"])
const isWon = (d) => d.status === "won" || WON.has(String(d.stage ?? ""))
const VEHICLE_FIELDS = ["licensePlate", "vehicleBrand", "vehicleModel", "truckNumber", "vehiclePhotoUrl", "vehiclePhotos",
  "totalSalePrice", "downPayment", "cashDown", "downInstallmentCount", "downInstallmentAmt", "financeAmount", "financeInstallments", "monthlyPayment", "extras"]

const c = await MongoClient.connect(process.env.MONGO_URI, { maxPoolSize: 2 })
const db = c.db(process.env.MONGO_DB ?? "mena_partner")
const all = await db.collection("quotations").find({}, { maxTimeMS: 30000 }).toArray()
console.log(`${execute ? "เขียนจริง" : "พรีวิว"}: ใบเสนอทั้งหมด ${all.length} ใบ`)

// union-find รวมใบที่ใช้ลูกค้าคนเดียวกัน
const parent = new Map(all.map((d) => [String(d._id), String(d._id)]))
const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b) }
const byKey = new Map()
const link = (key, id) => { if (!key) return; const prev = byKey.get(key); if (prev) union(prev, id); else byKey.set(key, id) }
for (const d of all) {
  const id = String(d._id)
  if (d.customerId) link(`id:${d.customerId}`, id)
  const ph = normPhone(d.customerPhone); if (ph.length >= 9) link(`ph:${ph}`, id)
  const nm = normName(d.customerName); if (nm.length >= 2) link(`nm:${nm}`, id)
}
const groups = new Map()
for (const d of all) { const r = find(String(d._id)); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(d) }
let dupGroups = [...groups.values()].filter((g) => g.length > 1)
if (onlyName) dupGroups = dupGroups.filter((g) => g.some((d) => normName(d.customerName).includes(normName(onlyName))))
console.log(`ลูกค้าที่มีใบซ้ำ: ${dupGroups.length} กลุ่ม (รวม ${dupGroups.reduce((a, g) => a + g.length, 0)} ใบ)\n`)

const now = new Date().toISOString()
let merged = 0, skipped = 0, removed = 0
for (const g of dupGroups.sort((a, b) => b.length - a.length)) {
  g.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
  const keep = g[0], olds = g.slice(1)
  const label = `${keep.customerName ?? "?"} (${keep.customerPhone ?? "-"})`
  const risky = olds.filter((o) => (isWon(o) && !isWon(keep)) || o.commissionPayouts)
  console.log(`▶ ${label} · ${g.length} ใบ → ยึด ${keep.quotationNo} (${keep.stage ?? keep.status} · ${String(keep.createdAt).slice(0, 10)} · เซลล์ ${keep.salesName || "-"})`)
  for (const o of olds) console.log(`     รวบ ${o.quotationNo}  ${o.stage ?? o.status}  ${String(o.createdAt).slice(0, 10)}  รถ ${o.licensePlate || "-"}  เซลล์ ${o.salesName || "-"}${risky.includes(o) ? "  ⚠ ใบเก่าปิดการขาย/มีทำจ่ายแล้ว" : ""}`)
  if (risky.length) { console.log("     ✗ ข้ามกลุ่มนี้ ให้คนตัดสินเอง\n"); skipped++; continue }

  // ประกอบข้อมูลที่จะย้ายเข้าใบที่ยึด
  const timeline = [...(keep.timeline ?? []).map((t) => ({ ...t }))]
  const vehicles = [...(keep.vehicles ?? [])]
  const seenPlates = new Set([normPlate(keep.licensePlate), ...vehicles.map((v) => normPlate(v.licensePlate))])
  const slips = new Set([...(keep.depositSlips ?? []), ...(keep.depositSlipUrl ? [keep.depositSlipUrl] : [])])
  const attachments = [...(keep.attachments ?? [])]
  const fill = {}
  for (const o of olds) {
    for (const t of o.timeline ?? []) timeline.push({ ...t, from: o.quotationNo })
    timeline.push({ at: String(o.createdAt ?? now), by: "system@merge", action: `ใบ ${o.quotationNo} (${o.stage ?? o.status}) ถูกรวบเข้าใบนี้`, from: o.quotationNo })
    if (o.licensePlate && !seenPlates.has(normPlate(o.licensePlate))) {
      const v = {}; for (const k of VEHICLE_FIELDS) if (o[k] !== undefined) v[k] = o[k]
      vehicles.push({ ...v, addedAt: String(o.createdAt ?? now), addedBy: `merge:${o.quotationNo}` })
      seenPlates.add(normPlate(o.licensePlate))
    }
    for (const s of o.depositSlips ?? []) slips.add(s)
    if (o.depositSlipUrl) slips.add(o.depositSlipUrl)
    for (const a of o.attachments ?? []) if (!attachments.some((x) => x.url === a.url)) attachments.push(a)
    if (!keep.customerPhone && o.customerPhone && !fill.customerPhone) fill.customerPhone = o.customerPhone
    if (!keep.customerId && o.customerId && !fill.customerId) fill.customerId = o.customerId
    if (!keep.salesName && o.salesName && !fill.salesName) { fill.salesName = o.salesName; fill.salesEmail = o.salesEmail ?? "" }
    if (!(keep.depositAmount > 0) && o.depositAmount > 0 && !fill.depositAmount) { fill.depositAmount = o.depositAmount; fill.reservationAmount = o.depositAmount }
  }
  timeline.sort((a, b) => String(a.at).localeCompare(String(b.at)))
  timeline.push({ at: now, by: "system@merge", action: `รวบใบซ้ำ ${olds.map((o) => o.quotationNo).join(", ")} เข้าใบนี้ (ยึดใบล่าสุด)` })
  console.log(`     → timeline ${timeline.length} รายการ · รถเสนอ ${vehicles.length} คัน · สลิป ${slips.size} · เติม ${Object.keys(fill).join(",") || "-"}\n`)
  merged++
  if (!execute) continue

  const slipList = [...slips].slice(0, 10)
  await db.collection("quotations").updateOne({ _id: keep._id }, {
    $set: {
      ...fill, timeline, vehicles, attachments, depositSlips: slipList,
      mergedFrom: [...(keep.mergedFrom ?? []), ...olds.map((o) => ({ _id: String(o._id), quotationNo: o.quotationNo, stage: o.stage ?? o.status, createdAt: o.createdAt }))],
      updatedAt: now, lastActivityAt: keep.lastActivityAt ?? now,
    },
  })
  for (const o of olds) {
    await db.collection("quotations_merged").insertOne({ ...o, mergedInto: String(keep._id), mergedIntoNo: keep.quotationNo, mergedAt: now })
    await db.collection("deal_stage_history").updateMany({ dealId: String(o._id) }, { $set: { dealId: String(keep._id), mergedFromDealId: String(o._id) } })
    await db.collection("quotations").deleteOne({ _id: o._id })
    removed++
  }
}
console.log(`\nสรุป: รวบ ${merged} กลุ่ม · ข้าม ${skipped} กลุ่ม (ต้องดูเอง)${execute ? ` · ย้ายใบเก่าไป quotations_merged ${removed} ใบ` : " · ยังไม่เขียนอะไร (ใส่ --execute เพื่อทำจริง)"}`)
await c.close()
