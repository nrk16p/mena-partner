import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** GET /api/adjustments?month=YYYY-MM — list all adjustments for a month */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const month = searchParams.get("month")?.trim() ?? ""
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 })

  const client = await clientPromise
  const db     = client.db(DB)
  const docs   = await db.collection("monthly_adjustments")
    .find({ month })
    .sort({ contractCode: 1 })
    .toArray()

  return NextResponse.json(docs)
}

/** PUT /api/adjustments — upsert one adjustment record */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { contractCode, month, ...fields } = body as {
    contractCode: string
    month: string
    otherIncomeWHT?: number
    otherIncomeNoWHT?: number
    otherDeductWHT?: number
    otherDeductNoWHT?: number
    note?: string
  }

  if (!contractCode || !month) {
    return NextResponse.json({ error: "contractCode and month required" }, { status: 400 })
  }

  const client = await clientPromise
  const db     = client.db(DB)
  const now    = new Date().toISOString()

  await db.collection("monthly_adjustments").updateOne(
    { contractCode, month },
    { $set: { contractCode, month, ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  )

  return NextResponse.json({ ok: true })
}
