import { MongoClient } from "mongodb"

const uri = process.env.MONGO_URI as string
const DB  = process.env.MONGO_DB ?? "mena_partner"

if (!uri) throw new Error("Please add MONGO_URI to .env.local")

let client: MongoClient

declare global {
  var _mongoClientPromise: Promise<MongoClient>
}

async function connect(): Promise<MongoClient> {
  client = new MongoClient(uri, {
    // เปิด connection ให้เร็วขึ้นบน serverless / cross-region (DigitalOcean ↔ Vercel)
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8000,
    compressors: ["zlib"],
  })
  await client.connect()
  // สร้าง index แบบ fire-and-forget — ไม่ block request แรกหลัง cold start
  // (index มีอยู่แล้วในฐานข้อมูล การรอ 25 round-trips ต่อ cold start คือ latency เปล่า)
  void ensureIndexes(client)
  return client
}

function ensureIndexes(client: MongoClient): Promise<unknown> {
  const db = client.db(DB)
  return Promise.all([
    db.collection("trips").createIndex({ contractCode: 1, date: 1 }),
    db.collection("trips").createIndex({ date: 1 }),
    db.collection("trips").createIndex({ ldtNumber: 1 }),
    db.collection("payroll_entries").createIndex({ month: 1, contractCode: 1 }, { unique: true }),
    db.collection("payroll_entries").createIndex({ month: 1 }),
    db.collection("contracts").createIndex({ contractCode: 1 }, { unique: true }),
    db.collection("contracts").createIndex({ status: 1 }),
    db.collection("contracts").createIndex({ taxExpiryDate: 1 }),
    db.collection("drivers").createIndex({ contractCode: 1 }, { unique: true }),
    db.collection("drivers").createIndex({ status: 1 }),
    db.collection("trips").createIndex({ plant: 1, date: 1 }),
    db.collection("repair_claims").createIndex({ contractCode: 1 }),
    db.collection("pm_records").createIndex({ contractCode: 1, year: 1 }),
    db.collection("promo_config").createIndex({ contractCode: 1 }),
    db.collection("promo_config").createIndex({ licensePlate: 1 }),
    db.collection("debt_acceptances").createIndex({ contractCode: 1 }),
    db.collection("debt_acceptances").createIndex({ debtAcceptanceNo: 1 }, { unique: true }),
    db.collection("repair_monthly").createIndex({ contractCode: 1, month: 1 }, { unique: true }),
    db.collection("repair_monthly").createIndex({ month: 1 }),
    db.collection("gps_config").createIndex({ contractCode: 1 }, { unique: true }),
    db.collection("installment_schedule").createIndex({ contractCode: 1 }, { unique: true }),
    db.collection("fuel_records").createIndex({ contractCode: 1, month: 1 }, { unique: true }),
    db.collection("monthly_adjustments").createIndex({ contractCode: 1, month: 1 }, { unique: true }),
    db.collection("month_status").createIndex({ month: 1 }, { unique: true }),
    db.collection("activity_log").createIndex({ entity: 1, entityId: 1, editedAt: -1 }),
    // stock_movements = 435k แถว — index กันการ scan เต็ม (รายงาน/promo-usage กรองตาม date/mr)
    db.collection("stock_movements").createIndex({ date: 1 }),
    db.collection("stock_movements").createIndex({ mr: 1 }),
    db.collection("stock_movements").createIndex({ promoType: 1 }),
    db.collection("debt_acceptances").createIndex({ repairOrderNo: 1 }),
  ]).catch(() => { /* non-fatal: index creation errors don't block the app */ })
}

if (!global._mongoClientPromise) {
  global._mongoClientPromise = connect()
}

const clientPromise = global._mongoClientPromise

export default clientPromise
