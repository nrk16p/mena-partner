#!/usr/bin/env node
/**
 * migrate-insurance-tax.mjs
 * ย้าย field ภาษี/ประกันที่ฝังอยู่ใน contracts → collection ใหม่ vehicle_insurance_tax
 * (1 contract ที่มีข้อมูล = 1 cycle, status "active", migratedFrom = contractCode)
 *
 * DEFAULT = DRY-RUN: พิมพ์สรุปอย่างเดียว ไม่เขียนอะไรลง DB
 * ใช้ --apply เพื่อ insert จริง (idempotent — ข้าม plate ที่มี cycle อยู่แล้ว)
 *
 *   node scripts/migrate-insurance-tax.mjs           # dry-run
 *   node scripts/migrate-insurance-tax.mjs --apply   # insert จริง
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

/** "สบ.71-1515" → "71-1515" (เหมือน normPlateIT ใน lib/insurance-tax.ts) */
const normPlate = (p) => (p ?? "").replace(/^[^0-9]*/, "").trim()

/** ISO date "YYYY-MM-DD…" → "YYYY-MM" */
const toMonth = (d) => (typeof d === "string" && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : undefined)

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)

const TAX_FIELDS = [
  "insuranceCompany", "insurer", "insuranceAmount", "prbAmount", "taxAmount",
  "inspectionCost", "taxInsuranceTotalCost", "monthlyInsuranceFee",
  "taxRenewalDate", "taxExpiryDate", "taxEndDate", "taxInstallmentCount",
  "taxMonthlyInstallment", "taxMonthlyCollection", "taxInstallmentStart", "taxInstallmentEnd",
]

const client = new MongoClient(uri)
await client.connect()
const db = client.db(DB)

try {
  const contracts = await db
    .collection("contracts")
    .find({ $or: TAX_FIELDS.map((f) => ({ [f]: { $exists: true, $nin: [null, ""] } })) })
    .toArray()

  const now = new Date().toISOString()
  const cycles = []
  const skippedNoPlate = []

  for (const c of contracts) {
    const platePlain = normPlate(c.licensePlate)
    if (!platePlain) { skippedNoPlate.push(c.contractCode); continue }

    const costSum =
      (num(c.insuranceAmount) ?? 0) + (num(c.prbAmount) ?? 0) +
      (num(c.taxAmount) ?? 0) + (num(c.inspectionCost) ?? 0)

    const cycle = {
      licensePlate: c.licensePlate,
      platePlain,
      effectiveDate: c.taxRenewalDate || undefined,
      expiryDate: c.taxExpiryDate || c.taxEndDate || undefined,
      insuranceCompany: c.insuranceCompany || undefined,
      insurer: c.insurer || undefined,
      insuranceAmount: num(c.insuranceAmount),
      prbAmount: num(c.prbAmount),
      taxAmount: num(c.taxAmount),
      inspectionCost: num(c.inspectionCost),
      totalCost: num(c.taxInsuranceTotalCost) ?? (costSum > 0 ? costSum : undefined),
      installmentCount: num(c.taxInstallmentCount),
      monthlyInstallment: num(c.taxMonthlyInstallment) ?? num(c.taxMonthlyCollection) ?? num(c.monthlyInsuranceFee),
      collectStart: toMonth(c.taxInstallmentStart),
      collectEnd: toMonth(c.taxInstallmentEnd),
      status: "active",
      migratedFrom: c.contractCode,
      createdAt: now,
      updatedAt: now,
    }
    // ตัด undefined ออกให้ document สะอาด
    for (const k of Object.keys(cycle)) if (cycle[k] === undefined) delete cycle[k]
    cycles.push(cycle)
  }

  // ── สรุป ──────────────────────────────────────────────────────────────────
  console.log(`\n${APPLY ? "=== APPLY ===" : "=== DRY-RUN (no writes) ==="}`)
  console.log(`db: ${DB} | contracts with tax/insurance fields: ${contracts.length} | cycles to create: ${cycles.length}`)
  if (skippedNoPlate.length) console.log(`skipped (no licensePlate): ${skippedNoPlate.join(", ")}`)

  console.table(cycles.map((c) => ({
    plate: c.licensePlate,
    company: c.insuranceCompany ?? c.insurer ?? "-",
    expiry: c.expiryDate ?? "-",
    monthly: c.monthlyInstallment ?? "-",
    total: c.totalCost ?? "-",
    from: c.migratedFrom,
  })))

  if (!APPLY) {
    console.log("dry-run เท่านั้น — ไม่มีการเขียน DB. ใช้ --apply เพื่อ insert จริง")
  } else {
    // idempotent: ข้าม plate ที่มี cycle ใน collection อยู่แล้ว
    const existing = await db
      .collection("vehicle_insurance_tax")
      .distinct("platePlain", { platePlain: { $in: cycles.map((c) => c.platePlain) } })
    const existingSet = new Set(existing)
    const toInsert = cycles.filter((c) => !existingSet.has(c.platePlain))
    const skipped  = cycles.length - toInsert.length
    if (skipped) console.log(`skip ${skipped} plate(s) ที่มี cycle อยู่แล้ว`)
    if (toInsert.length) {
      const res = await db.collection("vehicle_insurance_tax").insertMany(toInsert)
      console.log(`inserted ${res.insertedCount} cycle(s)`)
    } else {
      console.log("ไม่มีอะไรต้อง insert")
    }
  }
} finally {
  await client.close()
}
