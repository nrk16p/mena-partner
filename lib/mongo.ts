import { MongoClient } from "mongodb"

const uri = process.env.MONGO_URI as string
const DB  = process.env.MONGO_DB ?? "mena_partner"

if (!uri) throw new Error("Please add MONGO_URI to .env.local")

let client: MongoClient

declare global {
  var _mongoClientPromise: Promise<MongoClient>
}

async function connect(): Promise<MongoClient> {
  client = new MongoClient(uri)
  await client.connect()
  // Create indexes in the background — idempotent (safe to call repeatedly)
  const db = client.db(DB)
  await Promise.all([
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
  ]).catch(() => { /* non-fatal: index creation errors don't block the app */ })
  return client
}

if (!global._mongoClientPromise) {
  global._mongoClientPromise = connect()
}

const clientPromise = global._mongoClientPromise

export default clientPromise
