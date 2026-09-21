#!/usr/bin/env node
/**
 * import-clean-photos.mjs — เติมรูป 5 ด้านให้ vehicle_master จากไฟล์ "รูปรถสะอาด_Mixer_ล่าสุด_5ด้าน.xlsx"
 * (ระบบ truckcleaning ถ่ายรอบคัน: front/back/left/right/interior → photos.{front,back,left,right,cabin})
 * URL อยู่บน DO Spaces เดิมอยู่แล้ว — ไม่ต้องอัปโหลดไฟล์ แค่เขียน URL ลง DB
 *
 * นโยบาย: เติมเฉพาะช่องที่ว่าง (รูปที่ทีมอัปเองไม่ถูกทับ) · photoUrl ว่าง → ใช้ front
 *   node scripts/import-clean-photos.mjs <rows.json>            # dry-run
 *   node scripts/import-clean-photos.mjs <rows.json> --apply    # เขียนจริง
 *   --ready-only   จำกัดเฉพาะรถพร้อมขาย (saleStatus ready + ไม่มีสัญญา)   --overwrite   ทับทุกช่อง
 */
import { MongoClient } from "mongodb"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
for (const f of [".env.local", ".env"]) {
  try { for (const line of readFileSync(resolve(ROOT, f), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  } } catch { /* skip */ }
}
const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const APPLY = args.includes("--apply"), READY_ONLY = args.includes("--ready-only"), OVERWRITE = args.includes("--overwrite")
if (!file) { console.error("usage: import-clean-photos.mjs <rows.json> [--apply] [--ready-only] [--overwrite]"); process.exit(1) }
const normPlate = (p) => String(p ?? "").replace(/^[^0-9]*/, "").trim()
const SIDES = ["front", "back", "left", "right", "cabin"]
const isUrl = (u) => /^https?:\/\//.test(String(u ?? ""))

// ชีตใส่ "—" แทนรูปที่ไม่มี — ต้องกรองออก ไม่งั้นกลายเป็น URL เสีย (บทเรียน 2026-09-21)
const rows = JSON.parse(readFileSync(file, "utf8")).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, SIDES.includes(k) && !isUrl(v) ? "" : v])))
const byPlate = new Map(rows.map((r) => [normPlate(r.plate), r]))

const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
await client.connect()
const db = client.db(process.env.MONGO_DB ?? "mena_partner")
try {
  const [vehicles, prices, contracts] = await Promise.all([
    db.collection("vehicle_master").find({}, { projection: { licensePlate: 1, truckNumber: 1, status: 1, photoUrl: 1, photos: 1 } }).toArray(),
    db.collection("master_price_list").find({}, { projection: { licensePlate: 1, saleStatus: 1 } }).toArray(),
    db.collection("contracts").find({ status: "active" }, { projection: { licensePlate: 1 } }).toArray(),
  ])
  const priceBy = new Map(prices.map((p) => [normPlate(p.licensePlate), p]))
  const underContract = new Set(contracts.map((c) => normPlate(c.licensePlate)))
  const isReady = (v) => { const k = normPlate(v.licensePlate); return v.status !== "inactive" && !underContract.has(k) && priceBy.get(k)?.saleStatus === "ready" }

  let matched = 0, willUpdate = 0, slotsFilled = 0, readyMatched = 0, readyUpdate = 0
  const ops = []
  for (const v of vehicles) {
    const r = byPlate.get(normPlate(v.licensePlate))
    if (!r) continue
    matched++
    const ready = isReady(v)
    if (ready) readyMatched++
    if (READY_ONLY && !ready) continue
    const cur = v.photos ?? {}
    const $set = {}
    let n = 0
    for (const s of SIDES) {
      if (r[s] && (OVERWRITE || !String(cur[s] ?? "").trim())) { $set[`photos.${s}`] = r[s]; n++ }
    }
    if (r.front && (OVERWRITE || !String(v.photoUrl ?? "").trim())) $set.photoUrl = r.front
    if (Object.keys($set).length === 0) continue
    willUpdate++; slotsFilled += n
    if (ready) readyUpdate++
    $set.photosSource = "truckcleaning-xlsx"; $set.updatedAt = new Date()
    ops.push({ updateOne: { filter: { _id: v._id }, update: { $set } } })
  }
  console.log(`โหมด: ${APPLY ? "APPLY" : "DRY-RUN"}${READY_ONLY ? " (ready-only)" : ""}${OVERWRITE ? " (overwrite)" : ""}`)
  console.log(`ไฟล์ ${rows.length} คัน · vehicle_master ${vehicles.length} คัน · ทะเบียนตรงกัน ${matched} คัน`)
  console.log(`จะอัปเดต ${willUpdate} คัน (เติม ${slotsFilled} ช่องรูป) · ในนั้นเป็นรถพร้อมขาย ${readyUpdate}/${readyMatched} คัน`)
  if (APPLY && ops.length) {
    const res = await db.collection("vehicle_master").bulkWrite(ops)
    console.log(`✓ matched ${res.matchedCount} modified ${res.modifiedCount}`)
  } else if (!APPLY) console.log("(dry-run — ใส่ --apply เพื่อเขียนจริง)")
} finally { await client.close() }
