#!/usr/bin/env node
/**
 * clear-promo-usage.mjs
 * เคลียร์ "ยอดใช้แล้ว" ของโปรโมชั่นทุกคันให้เป็น 0
 *
 * ยอดใช้แล้วไม่ได้เก็บเป็นตัวเลขใน DB — lib/promo-usage.ts คำนวณสดจาก 3 แหล่ง:
 *   stock_movements  promoType ∈ {repair, pm}   → ตัดงบซ่อม / PM
 *   repair_claims    confirmed === true          → ตัดงบซ่อม
 *   pm_records       confirmed === true          → ตัดเพดาน PM
 * สคริปต์นี้จึง "ปลดธง" ทั้ง 3 แหล่ง ไม่ลบ record ใด ๆ (ย้อนกลับได้จากไฟล์ backup)
 *
 * ⚠️ ผลข้างเคียงที่ยอมรับแล้ว: app/api/repair-monthly/summarize/route.ts ใช้
 *    charge = chargeAmount ?? (promoType ? 0 : amount)
 *    เมื่อล้าง promoType รายการที่เคย "ติดโปรฯ ไม่คิดเงิน" จะกลายเป็นเรียกเก็บ
 *    เต็มจำนวนจาก พจส. ในสรุปค่าซ่อมรายเดือน (ตามที่ผู้ใช้เลือกไว้ 2026-08-17)
 *
 * DEFAULT = DRY-RUN: นับ + เขียนไฟล์ backup อย่างเดียว ไม่แตะ DB
 *   node scripts/clear-promo-usage.mjs           # dry-run + backup
 *   node scripts/clear-promo-usage.mjs --apply   # เขียนจริง
 *   node scripts/clear-promo-usage.mjs --restore backups/promo-clear-<ts>   # ย้อนกลับ
 */
import { MongoClient, ObjectId } from "mongodb"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(ROOT, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch { /* file not found — skip */ }
}

const uri = process.env.MONGO_URI
const DB  = process.env.MONGO_DB ?? "mena_partner"
if (!uri) { console.error("MONGO_URI not set (check .env.local)"); process.exit(1) }

const APPLY   = process.argv.includes("--apply")
const restIdx = process.argv.indexOf("--restore")
const RESTORE = restIdx >= 0 ? process.argv[restIdx + 1] : null

const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const fmt = (n) => n.toLocaleString("en-US")

// แถวที่นับเป็น "ยอดใช้แล้ว" ตาม lib/promo-usage.ts
const FILTERS = {
  stock_movements: { promoType: { $in: ["repair", "pm"] } },
  repair_claims:   { confirmed: true },
  pm_records:      { confirmed: true },
}
// field ที่ต้องเก็บค่าเดิมไว้ให้ย้อนกลับได้
const BACKUP_FIELDS = {
  stock_movements: { promoType: 1, pmType: 1, chargeAmount: 1, mr: 1, licensePlate: 1, date: 1, amount: 1 },
  repair_claims:   { confirmed: 1, contractCode: 1, mr: 1, date: 1, amount: 1 },
  pm_records:      { confirmed: 1, contractCode: 1, type: 1, year: 1, date: 1, amount: 1 },
}
// ค่าใหม่ที่จะเขียนทับ
const UPDATES = {
  stock_movements: { promoType: "", pmType: "" },
  repair_claims:   { confirmed: false },
  pm_records:      { confirmed: false },
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
await client.connect()
const db = client.db(DB)

try {
  if (RESTORE) {
    // ── โหมดย้อนกลับ ────────────────────────────────────────────────────────
    const dir = resolve(ROOT, RESTORE)
    console.log(`↩︎  restore จาก ${dir}\n`)
    for (const coll of Object.keys(FILTERS)) {
      let docs
      try { docs = JSON.parse(readFileSync(resolve(dir, `${coll}.json`), "utf8")) }
      catch { console.log(`   ${coll.padEnd(16)} ไม่มีไฟล์ backup — ข้าม`); continue }
      let n = 0
      for (const d of docs) {
        const { _id, ...old } = d
        const $set = {}, $unset = {}
        for (const k of Object.keys(UPDATES[coll])) {
          if (k in old) $set[k] = old[k]; else $unset[k] = ""
        }
        const op = {}
        if (Object.keys($set).length) op.$set = $set
        if (Object.keys($unset).length) op.$unset = $unset
        if (APPLY) await db.collection(coll).updateOne({ _id: new ObjectId(_id) }, op)
        n++
      }
      console.log(`   ${coll.padEnd(16)} ${APPLY ? "คืนค่า" : "จะคืนค่า"} ${fmt(n)} แถว`)
    }
    if (!APPLY) console.log("\n(dry-run — ใส่ --apply เพื่อคืนค่าจริง)")
    process.exit(0)
  }

  // ── นับ + backup ─────────────────────────────────────────────────────────
  console.log(`DB: ${DB}   โหมด: ${APPLY ? "APPLY (เขียนจริง)" : "DRY-RUN (ไม่แตะ DB)"}\n`)
  const backupDir = resolve(ROOT, "backups", `promo-clear-${STAMP}`)
  mkdirSync(backupDir, { recursive: true })

  const summary = []
  for (const coll of Object.keys(FILTERS)) {
    const total    = await db.collection(coll).estimatedDocumentCount()
    const affected = await db.collection(coll).countDocuments(FILTERS[coll])
    const docs = await db.collection(coll)
      .find(FILTERS[coll]).project(BACKUP_FIELDS[coll]).toArray()
    writeFileSync(
      resolve(backupDir, `${coll}.json`),
      JSON.stringify(docs.map((d) => ({ ...d, _id: String(d._id) })), null, 1)
    )
    // ยอดเงินที่จะหลุดออกจากการนับ (เช็คว่าตรงกับที่เห็นบนหน้าเว็บ)
    const sum = docs.reduce((s, d) => s + (Number(d.amount) || 0), 0)
    summary.push({ coll, total, affected, sum })
    console.log(`${coll.padEnd(16)} ทั้ง collection ${fmt(total).padStart(8)}  →  กระทบ ${fmt(affected).padStart(6)} แถว  รวม ฿${fmt(Math.round(sum))}`)
  }
  console.log(`\nbackup → ${backupDir}`)

  if (!APPLY) {
    console.log("\n(dry-run — ยังไม่เขียนอะไรลง DB · ใส่ --apply เพื่อเขียนจริง)")
    process.exit(0)
  }

  // ── เขียนจริง ─────────────────────────────────────────────────────────────
  console.log("")
  for (const { coll, affected } of summary) {
    if (!affected) { console.log(`${coll.padEnd(16)} ไม่มีแถวที่ต้องแก้ — ข้าม`); continue }
    const r = await db.collection(coll).updateMany(FILTERS[coll], { $set: UPDATES[coll] })
    console.log(`${coll.padEnd(16)} matched ${fmt(r.matchedCount)}  modified ${fmt(r.modifiedCount)}`)
  }

  // ── ยืนยันผล: ต้องเหลือ 0 แถวทุก collection ──────────────────────────────
  console.log("\nตรวจซ้ำหลังเขียน:")
  let leftover = 0
  for (const coll of Object.keys(FILTERS)) {
    const n = await db.collection(coll).countDocuments(FILTERS[coll])
    leftover += n
    console.log(`   ${coll.padEnd(16)} เหลือที่ยังนับเป็นยอดใช้ ${n} แถว ${n === 0 ? "✓" : "✗"}`)
  }
  console.log(leftover === 0 ? "\n✓ ยอดใช้แล้วเป็น 0 ทุกคัน" : `\n✗ ยังเหลือ ${leftover} แถว`)
} finally {
  await client.close()
}
