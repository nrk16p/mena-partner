import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET() {
  const client = await clientPromise
  const db = client.db(DB)

  const docs = await db
    .collection("promotion_master")
    .find({})
    .sort({ licensePlate: 1 })
    .toArray()

  return NextResponse.json(
    docs.map((d) => ({
      licensePlate:           d.licensePlate,
      pro1FreeCount:          d.pro1FreeCount,
      pro1TotalValue:         d.pro1TotalValue,
      pro1InstallmentValue:   d.pro1InstallmentValue,
      pro1Condition:          d.pro1Condition,
      pro1FreeAtInstallments: d.pro1FreeAtInstallments,
      pro2RepairBudget:       d.pro2RepairBudget,
      pro3AnnualPm:           d.pro3AnnualPm,
    }))
  )
}
