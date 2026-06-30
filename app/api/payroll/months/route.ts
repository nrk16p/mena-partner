import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET() {
  const client = await clientPromise
  const db = client.db(DB)
  const existing = (await db.collection("payroll_entries").distinct("month")) as string[]

  // Always include current month and the two preceding months
  const now = new Date()
  const anchors: string[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    anchors.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  const all = Array.from(new Set([...anchors, ...existing]))
  all.sort((a, b) => b.localeCompare(a))
  return NextResponse.json(all)
}
