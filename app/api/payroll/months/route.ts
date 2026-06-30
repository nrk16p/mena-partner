import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"
import { prevMonth } from "@/lib/utils"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET() {
  const client = await clientPromise
  const db = client.db(DB)
  const existing = (await db.collection("payroll_entries").distinct("month")) as string[]

  // Always include current month and the two preceding months (use Bangkok time UTC+7)
  const nowBKK = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const current = `${nowBKK.getUTCFullYear()}-${String(nowBKK.getUTCMonth() + 1).padStart(2, "0")}`
  const anchors = [current, prevMonth(current), prevMonth(prevMonth(current))]

  const all = Array.from(new Set([...anchors, ...existing]))
  all.sort((a, b) => b.localeCompare(a))
  return NextResponse.json(all)
}
