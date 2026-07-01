import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractCode: string }> }
) {
  const { contractCode } = await params
  const client = await clientPromise
  const db     = client.db(process.env.MONGO_DB ?? "mena_partner")

  const doc = await db
    .collection("repair_monthly")
    .findOne({ contractCode }, { sort: { month: -1 } })

  if (!doc) return NextResponse.json(null)
  return NextResponse.json(doc)
}
