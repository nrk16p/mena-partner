import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { diffFields, logActivity } from "@/lib/activity-log"

const DB = process.env.MONGO_DB ?? "mena_partner"

const NUM_FIELDS = [
  "totalSalePrice", "downPayment", "cashDown", "remainingInstallment",
  "downInstallmentCount", "downInstallmentAmt", "financeAmount",
  "financeInstallments", "monthlyPayment",
] as const

type Ctx = { params: Promise<{ plate: string }> }

/** PUT /api/price-list/[plate] — แก้ตัวเลขราคาขาย + บันทึกประวัติ (activity_log → drawer ประวัติราคา) */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { plate: raw } = await params
  const plate = decodeURIComponent(raw).trim()
  const body = await req.json() as Record<string, unknown>

  const client = await clientPromise
  const col = client.db(DB).collection("master_price_list")

  const before = await col.findOne({ licensePlate: plate })
  if (!before) return NextResponse.json({ error: "ไม่พบทะเบียนนี้ใน price list" }, { status: 404 })

  const next: Record<string, unknown> = {}
  for (const k of NUM_FIELDS) {
    if (k in body) {
      const v = body[k]
      next[k] = v === null || v === undefined || v === "" ? null : Number(v)
    }
  }
  if (Object.keys(next).length === 0)
    return NextResponse.json({ error: "no fields to update" }, { status: 400 })

  await col.updateOne(
    { licensePlate: plate },
    { $set: { ...next, updatedAt: new Date().toISOString() } },
  )

  const changes = diffFields(before, next, Object.keys(next))
  if (Object.keys(changes).length > 0) {
    const session = await getServerSession(authOptions)
    await logActivity({
      entity: "price_list",
      entityId: plate,
      action: "update",
      changes,
      editedBy: { email: session?.user?.email ?? "unknown", name: session?.user?.name ?? undefined },
    })
  }

  return NextResponse.json({ ok: true })
}
