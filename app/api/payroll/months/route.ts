import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET() {
  const client = await clientPromise
  const db = client.db(DB)
  const months = await db.collection("payroll_entries")
    .distinct("month")
  months.sort((a: string, b: string) => b.localeCompare(a))
  return NextResponse.json(months)
}
