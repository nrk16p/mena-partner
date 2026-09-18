#!/usr/bin/env node
/**
 * backfill-public-slug.mjs — เติม vehicle_master.publicSlug ให้รถพร้อมขาย (หน้า /trucks)
 * slug ต้องคงที่ตลอดไป: ถ้าแก้ยี่ห้อ/รุ่นภายหลัง URL ที่ Google เก็บไว้ต้องไม่เปลี่ยน
 * สูตรต้องตรงกับ makeSlug() ใน lib/public-trucks.ts (ไฟล์นั้นเป็น TS import เข้า .mjs ตรงไม่ได้)
 *
 * DEFAULT = DRY-RUN
 *   node scripts/backfill-public-slug.mjs           # แสดงว่าจะเขียนอะไร ไม่แตะ DB
 *   node scripts/backfill-public-slug.mjs --apply   # เขียนจริง + สร้าง unique index
 */
import { MongoClient } from "mongodb"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(ROOT, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch { /* ไม่มีไฟล์ — ข้าม */ }
}

const uri = process.env.MONGO_URI
const DB  = process.env.MONGO_DB ?? "mena_partner"
if (!uri) { console.error("MONGO_URI not set"); process.exit(1) }
const APPLY = process.argv.includes("--apply")

const normPlate = (p) => String(p ?? "").replace(/^[^0-9]*/, "").trim()
const slugPart  = (v) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const regYear   = (d) => { const y = Number(String(d ?? "").slice(0, 4)); return Number.isInteger(y) && y > 1900 && y < 2200 ? y : null }
const makeSlug  = (v) => {
  const year = regYear(v.registrationDate)
  const head = slugPart(v.truckNumber) || `t-${createHash("sha256").update(String(v.licensePlate ?? "").trim()).digest("hex").slice(0, 6)}`
  return [head, slugPart(v.brand), slugPart(v.model), year ? String(year + 543) : ""].filter(Boolean).join("-").replace(/-+/g, "-")
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
await client.connect()
const db = client.db(DB)
try {
  const [vehicles, prices, contracts] = await Promise.all([
    db.collection("vehicle_master").find({}, { projection: { licensePlate: 1, truckNumber: 1, brand: 1, model: 1, registrationDate: 1, status: 1, publicSlug: 1 } }).toArray(),
    db.collection("master_price_list").find({}, { projection: { licensePlate: 1, saleStatus: 1 } }).toArray(),
    db.collection("contracts").find({ status: "active" }, { projection: { licensePlate: 1 } }).toArray(),
  ])
  const priceBy = new Map(prices.map((p) => [normPlate(p.licensePlate), p]))
  const underContract = new Set(contracts.map((c) => normPlate(c.licensePlate)))
  const taken = new Set(vehicles.map((v) => v.publicSlug).filter(Boolean))

  const ready = vehicles.filter((v) => {
    const k = normPlate(v.licensePlate)
    return v.status !== "inactive" && !underContract.has(k) && priceBy.get(k)?.saleStatus === "ready"
  })
  console.log(`DB: ${DB}   โหมด: ${APPLY ? "APPLY" : "DRY-RUN"}`)
  console.log(`รถพร้อมขาย ${ready.length} คัน · มี publicSlug แล้ว ${ready.filter((v) => v.publicSlug).length} คัน\n`)

  let written = 0
  for (const v of ready) {
    if (v.publicSlug) { console.log(`   ${String(v.truckNumber ?? "-").padEnd(8)} มีแล้ว: ${v.publicSlug}`); continue }
    let slug = makeSlug(v)
    if (taken.has(slug)) { let i = 2; while (taken.has(`${slug}-${i}`)) i++; slug = `${slug}-${i}` }
    taken.add(slug)
    console.log(`   ${String(v.truckNumber ?? "-").padEnd(8)} ${APPLY ? "เขียน" : "จะเขียน"}: ${slug}`)
    if (APPLY) await db.collection("vehicle_master").updateOne({ _id: v._id }, { $set: { publicSlug: slug } })
    written++
  }

  if (APPLY) {
    // unique เฉพาะ doc ที่มี publicSlug (partial) — รถที่ยังไม่ publish ไม่ติดกติกา
    await db.collection("vehicle_master").createIndex(
      { publicSlug: 1 },
      { unique: true, partialFilterExpression: { publicSlug: { $type: "string" } } },
    )
    console.log(`\n✓ เขียน ${written} คัน + สร้าง unique index publicSlug_1 แล้ว`)
  } else {
    console.log(`\n(dry-run — จะเขียน ${written} คัน · ใส่ --apply เพื่อเขียนจริง)`)
  }
} finally { await client.close() }
