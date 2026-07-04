import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

// Actual promotion usage per vehicle, derived from stock_movements
// where items were marked promoType = "repair" | "pm" on the vehicle-cost page.
// Plate is normalized ("สบ.71-1959" → "71-1959") for matching.

function normPlate(p: string): string {
  const m = String(p).match(/\d{2}-\d{4}/)
  return m ? m[0] : String(p).trim()
}

export async function GET() {
  const client = await clientPromise
  const db     = client.db(process.env.MONGO_DB ?? "mena_partner")

  const agg = await db.collection("stock_movements").aggregate([
    { $match: { promoType: { $in: ["repair", "pm"] } } },
    {
      $group: {
        _id:   { plate: "$licensePlate", type: "$promoType" },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]).toArray()

  const byPlate: Record<string, { plate: string; repairUsed: number; repairCount: number; pmUsed: number; pmCount: number }> = {}
  for (const row of agg) {
    const plate = normPlate(String(row._id.plate ?? ""))
    if (!plate) continue
    if (!byPlate[plate]) byPlate[plate] = { plate, repairUsed: 0, repairCount: 0, pmUsed: 0, pmCount: 0 }
    if (row._id.type === "repair") { byPlate[plate].repairUsed += row.total; byPlate[plate].repairCount += row.count }
    if (row._id.type === "pm")     { byPlate[plate].pmUsed     += row.total; byPlate[plate].pmCount     += row.count }
  }

  return NextResponse.json(Object.values(byPlate))
}
