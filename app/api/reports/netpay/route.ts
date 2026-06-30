import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const month = searchParams.get("month")?.trim() ?? ""
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 })

  const client  = await clientPromise
  const db      = client.db(DB)
  const entries = await db.collection("payroll_entries").find({ month }).toArray()
  const drivers = await db.collection("drivers").find({ status: "active" }).sort({ contractCode: 1 }).toArray()
  const tripAgg = await db.collection("trips").aggregate([
    {
      $match: {
        date: {
          $gte: new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1, 1).toISOString(),
          $lt:  new Date(Number(month.split("-")[0]), Number(month.split("-")[1]),     1).toISOString(),
        },
      },
    },
    { $group: { _id: "$contractCode", tripCount: { $sum: 1 }, totalTripFee: { $sum: "$tripFee" } } },
  ]).toArray()

  const tripMap  = Object.fromEntries(tripAgg.map((t) => [t._id as string, t]))
  const entryMap = Object.fromEntries(entries.map((e) => [e.contractCode as string, e]))

  const rows = drivers.map((d) => {
    const entry = entryMap[d.contractCode as string]
    const trips = tripMap[d.contractCode as string]
    return {
      contractCode:    d.contractCode,
      driverName:      d.driverName,
      truckNumber:     d.truckNumber ?? "",
      plant:           d.plant,
      tripCount:       trips?.tripCount ?? 0,
      totalTripFee:    trips?.totalTripFee ?? 0,
      workingDays:     entry?.workingDays ?? 0,
      totalIncome:     entry?.totalIncome ?? 0,
      totalDeductions: entry?.totalDeductions ?? 0,
      netPay:          entry?.netPay ?? 0,
      hasEntry:        !!entry,
    }
  })

  const summary = {
    totalDrivers:     drivers.length,
    driversWithEntry: entries.length,
    grandNetPay:      rows.reduce((s, r) => s + r.netPay, 0),
    grandIncome:      rows.reduce((s, r) => s + r.totalIncome, 0),
    grandDeductions:  rows.reduce((s, r) => s + r.totalDeductions, 0),
  }

  return NextResponse.json({ month, summary, rows })
}
