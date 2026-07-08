import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function GET() {
  const client = await clientPromise
  const db     = client.db(DB)

  const [docs, vehicles, contracts] = await Promise.all([
    db.collection("master_price_list").find({}).sort({ licensePlate: 1 }).toArray(),
    db.collection("vehicle_master").find({}, { projection: { licensePlate: 1, status: 1 } }).toArray(),
    db.collection("contracts").find({ status: "active" }, { projection: { licensePlate: 1 } }).toArray(),
  ])

  const vehicleStatus  = new Map(vehicles.map((v) => [v.licensePlate as string, (v.status as string) ?? "active"]))
  const activeContracts = new Set(contracts.map((c) => c.licensePlate as string))

  return NextResponse.json(
    docs.map((d) => {
      const plate = d.licensePlate as string
      const hasContract = activeContracts.has(plate)
      const vStatus     = vehicleStatus.get(plate) ?? "active"
      const status      = hasContract ? "contract" : vStatus   // "contract" | "active" | "inactive"
      return {
        licensePlate:         plate,
        status,
        // สถานะความพร้อมขาย + ช่วงซ่อม (แก้ได้จากหน้า price-list)
        saleStatus:           d.saleStatus  ?? null,
        repairStart:          d.repairStart ?? null,
        repairEnd:            d.repairEnd   ?? null,
        downPayment:          d.downPayment,
        cashDown:             d.cashDown,
        remainingInstallment: d.remainingInstallment,
        downInstallmentCount: d.downInstallmentCount,
        downInstallmentAmt:   d.downInstallmentAmt,
        financeInstallments:  d.financeInstallments,
        monthlyPayment:       d.monthlyPayment,
        financeAmount:        d.financeAmount,
        totalSalePrice:       d.totalSalePrice,
      }
    })
  )
}
