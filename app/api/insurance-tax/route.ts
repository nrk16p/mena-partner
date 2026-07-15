import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { normPlateIT, cycleDisplayStatus, type InsuranceCycle } from "@/lib/insurance-tax"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "vehicle_insurance_tax"

const COST_FIELDS = ["insuranceAmount", "prbAmount", "taxAmount", "inspectionCost"] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumCosts(body: Record<string, any>): number | undefined {
  if (!COST_FIELDS.some((f) => typeof body[f] === "number")) return undefined
  return COST_FIELDS.reduce((s, f) => s + (typeof body[f] === "number" ? body[f] : 0), 0)
}

export async function GET(req: NextRequest) {
  const client = await clientPromise
  const db     = client.db(DB)
  const plate  = req.nextUrl.searchParams.get("plate")?.trim()

  // ── GET ?plate=… → ทุก cycle ของทะเบียนนั้น ใหม่สุดก่อน ───────────────────
  if (plate) {
    const platePlain = normPlateIT(plate) || plate
    const cycles = await db
      .collection(COLL)
      .find({ platePlain })
      .sort({ createdAt: -1 })
      .toArray()
    return NextResponse.json({ cycles })
  }

  // ── GET (no params) → ทุกทะเบียนจาก vehicle_master (~315 แถว, bounded) ────
  const [vehicles, cycles, activeContracts] = await Promise.all([
    db.collection("vehicle_master")
      .find({})
      .project({ licensePlate: 1, truckNumber: 1, brand: 1, model: 1 })
      .toArray(),
    db.collection(COLL)
      .find({})
      .sort({ createdAt: -1 })
      .toArray(),
    db.collection("contracts")
      .find({ status: "active" })
      .project({ licensePlate: 1, driverName: 1, contractCode: 1 })
      .toArray(),
  ])

  // latest cycle + count ต่อ platePlain (cycles เรียง createdAt desc แล้ว)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestByPlate = new Map<string, any>()
  const countByPlate  = new Map<string, number>()
  for (const c of cycles) {
    if (!latestByPlate.has(c.platePlain)) latestByPlate.set(c.platePlain, c)
    countByPlate.set(c.platePlain, (countByPlate.get(c.platePlain) ?? 0) + 1)
  }

  // สัญญา active ต่อทะเบียน (normalized)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractByPlate = new Map<string, any>()
  for (const ct of activeContracts) {
    const p = normPlateIT(ct.licensePlate)
    if (p && !contractByPlate.has(p)) contractByPlate.set(p, ct)
  }

  const today = new Date().toISOString().slice(0, 10)
  const counts = { total: 0, active: 0, expiring: 0, expired: 0, none: 0 }

  const items = vehicles.map((v) => {
    const platePlain = normPlateIT(v.licensePlate)
    const current    = latestByPlate.get(platePlain) ?? null
    const contract   = contractByPlate.get(platePlain)
    const displayStatus = current ? cycleDisplayStatus(current, today) : "none"

    counts.total++
    if (displayStatus in counts) counts[displayStatus as keyof typeof counts]++

    return {
      licensePlate: v.licensePlate,
      platePlain,
      truckNumber:  v.truckNumber,
      brand:        v.brand,
      model:        v.model,
      driverName:   contract?.driverName,
      contractCode: contract?.contractCode,
      current,
      displayStatus,
      cyclesCount:  countByPlate.get(platePlain) ?? 0,
    }
  })

  return NextResponse.json({ items, counts })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.licensePlate) {
    return NextResponse.json({ error: "licensePlate required" }, { status: 400 })
  }

  const client = await clientPromise
  const col    = client.db(DB).collection(COLL)
  const now    = new Date().toISOString()

  const platePlain = normPlateIT(body.licensePlate) || body.licensePlate
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, createdAt, updatedAt, status, ...rest } = body

  const doc: InsuranceCycle = {
    ...rest,
    licensePlate: body.licensePlate,
    platePlain,
    totalCost: typeof body.totalCost === "number" ? body.totalCost : sumCosts(body),
    status: "active",
    createdAt: now,
    updatedAt: now,
  }

  // รอบใหม่แทนที่รอบเก่า — mark รอบเดิมทั้งหมดของทะเบียนนี้เป็น renewed (เก็บประวัติไว้)
  await col.updateMany(
    { platePlain, status: "active" },
    { $set: { status: "renewed", updatedAt: now } }
  )

  const result = await col.insertOne(doc as never)
  return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 })
}
