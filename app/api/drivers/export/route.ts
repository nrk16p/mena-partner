import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import clientPromise from "@/lib/mongo"
import { ageFrom, fullNameNoPrefix } from "@/lib/driver-export"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "drivers"

// Column order for the exported sheet
const HEADERS: { key: string; label: string }[] = [
  { key: "staffCode",    label: "รหัสพนักงาน" },
  { key: "fullName",    label: "ชื่อ-นามสกุล" },        // คอลัมน์เดียว ไม่มีคำนำหน้า · import แยกกลับให้
  { key: "birthDate",   label: "วันเกิด (YYYY-MM-DD)" },
  { key: "age",         label: "อายุ (ปี)" },
  { key: "nationalId",  label: "เลขบัตรประชาชน" },
  { key: "phone",       label: "เบอร์โทรศัพท์" },
  { key: "fleet",       label: "Fleet" },
  { key: "plant",       label: "Plant" },
  { key: "address",     label: "ที่อยู่" },
  { key: "startDate",   label: "เริ่มงาน (YYYY-MM-DD)" },
  { key: "endDate",     label: "สิ้นสุด (YYYY-MM-DD)" },
  { key: "isDriver",    label: "พนักงานขับรถ (TRUE/FALSE)" },
  { key: "isTruckOwner", label: "เจ้าของรถ (TRUE/FALSE)" },
  { key: "status",      label: "สถานะ (active/inactive)" },
]

export async function GET() {
  const client = await clientPromise
  const drivers = await client.db(DB).collection(COLL)
    .find({})
    .sort({ firstName: 1, lastName: 1 })
    .toArray()

  const rows = drivers.map((d) =>
    Object.fromEntries(
      HEADERS.map(({ key }) => [
        HEADERS.find((h) => h.key === key)!.label,
        key === "isDriver" || key === "isTruckOwner"
          ? d[key] ? "TRUE" : "FALSE"
          : key === "fullName" ? fullNameNoPrefix(d.firstName, d.lastName)
          : key === "age" ? ageFrom(d.birthDate)
          : (d[key] ?? ""),
      ])
    )
  )

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: HEADERS.map((h) => h.label),
  })

  // Column widths
  ws["!cols"] = HEADERS.map((h) =>
    h.key === "address" ? { wch: 40 } : h.key === "fullName" ? { wch: 28 } : h.key === "age" ? { wch: 10 } : { wch: Math.max(h.label.length + 4, 18) }
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "พนักงาน")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="drivers_${today}.xlsx"`,
    },
  })
}
