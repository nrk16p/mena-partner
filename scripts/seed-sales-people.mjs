#!/usr/bin/env node
/**
 * seed-sales-people.mjs
 * ย้ายรายชื่อผู้ขายค่าตั้งต้นใน lib/quotation-people.ts → collection sales_people
 * เพื่อให้แอดมินกรอก email / เบอร์โทร ให้แต่ละคนได้จากหน้า /quotations/sales-people
 *
 * idempotent — ชื่อที่มีใน DB อยู่แล้วจะถูกข้าม (เทียบแบบไม่สนตัวพิมพ์)
 *
 * DEFAULT = DRY-RUN
 *   node scripts/seed-sales-people.mjs           # ดูว่าจะเพิ่มใครบ้าง
 *   node scripts/seed-sales-people.mjs --apply   # insert จริง
 */
import { MongoClient } from "mongodb"
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
  } catch { /* file not found — skip */ }
}

const uri = process.env.MONGO_URI
const DB  = process.env.MONGO_DB ?? "mena_partner"
if (!uri) { console.error("MONGO_URI not set (check .env.local)"); process.exit(1) }

const APPLY = process.argv.includes("--apply")

// อ่านชื่อจาก lib/quotation-people.ts โดยตรง — ไม่ต้อง copy รายชื่อมาไว้สองที่
const src = readFileSync(resolve(ROOT, "lib/quotation-people.ts"), "utf8")
const block = src.match(/SALES_PEOPLE\s*=\s*\[([\s\S]*?)\]/)
if (!block) { console.error("อ่าน SALES_PEOPLE จาก lib/quotation-people.ts ไม่ได้"); process.exit(1) }
const NAMES = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
await client.connect()
try {
  const coll = client.db(DB).collection("sales_people")
  const have = new Set(
    (await coll.find({}).project({ name: 1, _id: 0 }).toArray())
      .map((r) => String(r.name ?? "").trim().toLowerCase())
  )
  const missing = NAMES.filter((n) => !have.has(n.trim().toLowerCase()))

  console.log(`DB: ${DB}   โหมด: ${APPLY ? "APPLY" : "DRY-RUN"}`)
  console.log(`ในโค้ด ${NAMES.length} ชื่อ · มีใน DB แล้ว ${NAMES.length - missing.length} · จะเพิ่ม ${missing.length}\n`)
  for (const n of missing) console.log(`   + ${n}`)
  if (!missing.length) console.log("   (ไม่มีอะไรต้องเพิ่ม)")

  if (!APPLY) { console.log("\n(dry-run — ใส่ --apply เพื่อ insert จริง)"); process.exit(0) }
  if (missing.length) {
    const now = new Date().toISOString()
    const r = await coll.insertMany(missing.map((name) => ({
      name, email: "", phone: "", createdAt: now, createdBy: "seed-sales-people",
    })))
    console.log(`\n✓ insert ${r.insertedCount} ชื่อ`)
  }
} finally {
  await client.close()
}
