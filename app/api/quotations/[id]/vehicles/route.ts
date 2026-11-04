import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { QUOTE_COLL } from "@/lib/quotation"
import { actorOf } from "@/lib/sales-owner"
import { normPlate, optionsOf, promote, type VehicleOption } from "@/lib/deal-vehicles"
import { promotionSummary } from "@/lib/promotion-summary"

const DB = process.env.MONGO_DB ?? "mena_partner"
type Ctx = { params: Promise<{ id: string }> }

/** snapshot รถ+ราคาจาก master (ไม่รับราคาจาก client กันแก้มั่ว) */
async function snapshotFromMaster(db: ReturnType<Awaited<typeof clientPromise>["db"]>, plate: string): Promise<VehicleOption | null> {
  const price = await db.collection("master_price_list").findOne({ licensePlate: plate })
  if (!price) return null
  const v = await db.collection("vehicle_master").findOne({ licensePlate: plate }, { projection: { brand: 1, model: 1, truckNumber: 1, photoUrl: 1, photos: 1 } })
  const n = (x: unknown) => Number(x) || 0
  const cashDown = n(price.cashDown)
  const remain = Math.max(0, n(price.downPayment) - cashDown)
  const cnt = n(price.downInstallmentCount)
  return {
    licensePlate: plate,
    vehicleBrand: String(v?.brand ?? ""), vehicleModel: String(v?.model ?? ""), truckNumber: String(v?.truckNumber ?? ""),
    vehiclePhotoUrl: String(v?.photoUrl ?? ""), vehiclePhotos: (v?.photos as VehicleOption["vehiclePhotos"]) ?? undefined,
    totalSalePrice: n(price.totalSalePrice), downPayment: n(price.downPayment), cashDown,
    downInstallmentCount: cnt, downInstallmentAmt: cnt ? Math.round(remain / cnt) : n(price.downInstallmentAmt),
    financeAmount: n(price.financeAmount), financeInstallments: n(price.financeInstallments), monthlyPayment: n(price.monthlyPayment),
  }
}

/** POST { action: "add" | "remove" | "primary", licensePlate } — รถหลายคันในดีลเดียว */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const actor = actorOf(session)
  const b = await req.json().catch(() => null)
  const action = String(b?.action ?? "")
  const plate = String(b?.licensePlate ?? "").trim()
  if (!plate) return NextResponse.json({ error: "ต้องระบุทะเบียน" }, { status: 400 })

  const db = (await clientPromise).db(DB)
  const deal = await db.collection(QUOTE_COLL).findOne({ _id: new ObjectId(id) })
  if (!deal) return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 })
  const now = new Date().toISOString()
  const options = optionsOf(deal as { licensePlate?: string; vehicles?: VehicleOption[] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let update: any
  if (action === "add") {
    if (normPlate(deal.licensePlate) === normPlate(plate) || options.some((v) => normPlate(v.licensePlate) === normPlate(plate))) {
      return NextResponse.json({ error: "คันนี้อยู่ในดีลแล้ว" }, { status: 409 })
    }
    const snap = await snapshotFromMaster(db, plate)
    if (!snap) return NextResponse.json({ error: "ไม่พบราคาขายของทะเบียนนี้ใน price list" }, { status: 404 })
    // ของแถมดึงจากโปรฯ ของคันนั้น ถ้าไม่มีใช้ของดีล
    const promos = await db.collection("promotion_master").find({}).toArray()
    const promo = promos.find((x) => normPlate(String(x.licensePlate ?? "")) === normPlate(plate))
    const extras = promotionSummary(promo as Record<string, unknown> | undefined) || String(deal.extras ?? "")
    const item: VehicleOption = { ...snap, extras, addedAt: now, addedBy: actor.email }
    if (!deal.licensePlate) {
      // ดีลยังไม่มีรถ (lead) → คันแรกเป็นคันหลักเลย
      update = {
        $set: { ...item, updatedAt: now, lastActivityAt: now, updatedBy: { ...actor, at: now } },
        $push: { timeline: { at: now, by: actor.email, action: `เลือกรถ ${plate} เป็นคันหลัก` } },
      }
    } else {
      update = {
        $set: { updatedAt: now, lastActivityAt: now, updatedBy: { ...actor, at: now } },
        $push: { vehicles: item, timeline: { at: now, by: actor.email, action: `เพิ่มรถเสนอ ${plate}` } },
      }
    }
  } else if (action === "remove") {
    if (!options.some((v) => normPlate(v.licensePlate) === normPlate(plate))) {
      return NextResponse.json({ error: "ถอดได้เฉพาะคันเสนอ (คันหลักให้ตั้งคันอื่นเป็นหลักก่อน)" }, { status: 400 })
    }
    update = {
      $set: { vehicles: options.filter((v) => normPlate(v.licensePlate) !== normPlate(plate)), updatedAt: now, lastActivityAt: now, updatedBy: { ...actor, at: now } },
      $push: { timeline: { at: now, by: actor.email, action: `ถอดรถเสนอ ${plate}` } },
    }
  } else if (action === "primary") {
    const r = promote(deal as { licensePlate?: string; vehicles?: VehicleOption[] }, plate)
    if (!r) return NextResponse.json({ error: "ไม่พบคันนี้ในรายการเสนอ" }, { status: 404 })
    const { addedAt: _a, addedBy: _b, ...fields } = r.primary
    void _a; void _b
    update = {
      $set: { ...fields, vehicles: r.vehicles, updatedAt: now, lastActivityAt: now, updatedBy: { ...actor, at: now } },
      $push: { timeline: { at: now, by: actor.email, action: `เปลี่ยนคันหลัก → ${plate}` } },
    }
  } else {
    return NextResponse.json({ error: "การกระทำไม่ถูกต้อง" }, { status: 400 })
  }

  await db.collection(QUOTE_COLL).updateOne({ _id: new ObjectId(id) }, update)
  const doc = await db.collection(QUOTE_COLL).findOne({ _id: new ObjectId(id) })
  return NextResponse.json({ ...doc, _id: String(doc?._id) })
}
