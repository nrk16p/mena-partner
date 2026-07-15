#!/usr/bin/env node
/**
 * split-insurance-items.mjs
 * แตก doc แบบ bundled ใน vehicle_insurance_tax (1 doc = ประกัน+พรบ.+ภาษี+ตรวจสภาพ)
 * → item docs แยกรายการ (itemType: insurance | prb | tax | inspection)
 *
 *   insurance  ← insuranceAmount (+ company = insuranceCompany || insurer,
 *                + monthlyInstallment/installmentCount/collectStart/collectEnd ถ้ามี —
 *                ระบบหักเดิมเป็นแบบ insurance-centric)
 *   prb        ← prbAmount
 *   tax        ← taxAmount
 *   inspection ← inspectionCost
 *
 * ข้าม item ที่ amount เป็น null/undefined (0 ยังสร้าง) — item ได้
 * effectiveDate/expiryDate/platePlain/licensePlate/migratedFrom/notes เดียวกับ doc ต้นทาง
 * status "active" ยกเว้นต้นทางเป็น "renewed" → "renewed"
 * จากนั้น mark doc ต้นทางเป็น status "converted" (ไม่ลบ — item queries กรองด้วย itemType อยู่แล้ว)
 *
 * Idempotent: ประมวลผลเฉพาะ doc ที่ไม่มี itemType และ status != "converted"
 *
 * DEFAULT = DRY-RUN: พิมพ์สรุปอย่างเดียว ไม่เขียนอะไรลง DB
 *   node scripts/split-insurance-items.mjs           # dry-run
 *   node scripts/split-insurance-items.mjs --apply   # เขียนจริง
 */
import { MongoClient } from "mongodb"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

// โหลด .env.local / .env แบบเบา ๆ (ตัวแปรชื่อเดียวกับ lib/mongo.ts: MONGO_URI, MONGO_DB)
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

const APPLY = process.argv.includes("--apply")
const COLL  = "vehicle_insurance_tax"

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)

// itemType → field ที่มาของ amount ใน doc ต้นทาง
const AMOUNT_FIELD = {
  insurance: "insuranceAmount",
  prb: "prbAmount",
  tax: "taxAmount",
  inspection: "inspectionCost",
}
const ITEM_TYPES = Object.keys(AMOUNT_FIELD)

const client = new MongoClient(uri)
await client.connect()
const db = client.db(DB)

try {
  // เฉพาะ doc bundled ที่ยังไม่ถูก convert
  const sources = await db
    .collection(COLL)
    .find({ itemType: { $exists: false }, status: { $ne: "converted" } })
    .toArray()

  const now = new Date().toISOString()
  const itemDocs = []            // ทั้งหมดที่จะ insert
  const perType  = { insurance: 0, prb: 0, tax: 0, inspection: 0 }
  const perSource = []           // สรุปต่อ source สำหรับ console.table

  for (const src of sources) {
    const status = src.status === "renewed" ? "renewed" : "active"
    const created = []

    for (const itemType of ITEM_TYPES) {
      const amount = num(src[AMOUNT_FIELD[itemType]])
      if (amount === undefined) continue // ไม่มียอด (null/undefined) → ไม่สร้าง item (0 ยังสร้าง)

      const item = {
        licensePlate: src.licensePlate,
        platePlain: src.platePlain,
        itemType,
        effectiveDate: src.effectiveDate || undefined,
        expiryDate: src.expiryDate || undefined,
        amount,
        status,
        notes: src.notes || undefined,
        migratedFrom: src.migratedFrom || undefined,
        createdAt: now,
        updatedAt: now,
      }
      if (itemType === "insurance") {
        // ระบบหักเงินเดิมผูกกับประกัน — ย้าย plan การหักไปที่ item insurance เท่านั้น
        item.company = src.insuranceCompany || src.insurer || undefined
        item.installmentCount = num(src.installmentCount)
        item.monthlyInstallment = num(src.monthlyInstallment)
        item.collectStart = src.collectStart || undefined
        item.collectEnd = src.collectEnd || undefined
      }
      // ตัด undefined ออกให้ document สะอาด
      for (const k of Object.keys(item)) if (item[k] === undefined) delete item[k]

      itemDocs.push({ sourceId: src._id, doc: item })
      perType[itemType]++
      created.push(itemType)
    }

    perSource.push({
      plate: src.licensePlate,
      srcStatus: src.status,
      items: created.join(",") || "(none)",
      expiry: src.expiryDate ?? "-",
      monthly: src.monthlyInstallment ?? "-",
      from: src.migratedFrom ?? "-",
    })
  }

  // ── สรุป ──────────────────────────────────────────────────────────────────
  console.log(`\n${APPLY ? "=== APPLY ===" : "=== DRY-RUN (no writes) ==="}`)
  console.log(`db: ${DB} | bundled source docs (no itemType, not converted): ${sources.length}`)
  console.log(`item docs to create: ${itemDocs.length}  ` +
    `(insurance: ${perType.insurance}, prb: ${perType.prb}, tax: ${perType.tax}, inspection: ${perType.inspection})`)
  const noItems = perSource.filter((s) => s.items === "(none)").length
  if (noItems) console.log(`source docs ที่ไม่มี amount เลย (จะถูก mark converted เฉย ๆ): ${noItems}`)

  console.log("\nตัวอย่าง source → items (10 แถวแรก):")
  console.table(perSource.slice(0, 10))
  console.log("ตัวอย่าง item doc (3 ใบแรก):")
  console.dir(itemDocs.slice(0, 3).map((x) => x.doc), { depth: null })

  if (!APPLY) {
    console.log("\ndry-run เท่านั้น — ไม่มีการเขียน DB. ใช้ --apply เพื่อเขียนจริง")
  } else {
    if (itemDocs.length) {
      const res = await db.collection(COLL).insertMany(itemDocs.map((x) => x.doc))
      console.log(`inserted ${res.insertedCount} item doc(s)`)
    }
    const srcIds = sources.map((s) => s._id)
    if (srcIds.length) {
      const upd = await db.collection(COLL).updateMany(
        { _id: { $in: srcIds } },
        { $set: { status: "converted", updatedAt: now } }
      )
      console.log(`marked ${upd.modifiedCount} source doc(s) as converted`)
    }
  }
} finally {
  await client.close()
}
