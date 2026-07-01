import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export type MonthPhase = "draft" | "review" | "approved" | "locked"

interface MonthStatusDoc {
  month: string
  phase: MonthPhase
  updatedAt: string
  updatedBy?: string
  notes?: string
}

/** GET /api/month-status?month=YYYY-MM */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const month = searchParams.get("month")?.trim() ?? ""
  if (!month) {
    // Return all months with status
    const client = await clientPromise
    const db     = client.db(DB)
    const docs   = await db.collection("month_status").find({}).sort({ month: -1 }).toArray()
    return NextResponse.json(docs)
  }

  const client = await clientPromise
  const db     = client.db(DB)
  const doc    = await db.collection("month_status").findOne({ month })

  if (!doc) return NextResponse.json({ month, phase: "draft" as MonthPhase })
  return NextResponse.json(doc)
}

/** POST /api/month-status — set phase for a month */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as Partial<MonthStatusDoc>
  const { month, phase, notes } = body

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 })
  }
  const validPhases: MonthPhase[] = ["draft", "review", "approved", "locked"]
  if (!phase || !validPhases.includes(phase)) {
    return NextResponse.json({ error: `phase must be one of: ${validPhases.join(", ")}` }, { status: 400 })
  }

  const client = await clientPromise
  const db     = client.db(DB)
  const now    = new Date().toISOString()

  await db.collection("month_status").updateOne(
    { month },
    {
      $set: {
        month,
        phase,
        notes: notes ?? "",
        updatedAt: now,
        updatedBy: session.user?.email ?? "unknown",
      },
    },
    { upsert: true }
  )

  return NextResponse.json({ ok: true, month, phase })
}
