import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import clientPromise from "@/lib/mongo"
import { findDuplicateDriver } from "@/lib/driver-unique"
import { splitFullName } from "@/lib/driver-export"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "drivers"

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v
  const s = String(v ?? "").trim().toUpperCase()
  return s === "TRUE" || s === "1" || s === "YES"
}

function parseStr(v: unknown): string | null {
  const s = String(v ?? "").trim()
  return s === "" ? null : s
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const buf  = Buffer.from(await file.arrayBuffer())
  const wb   = XLSX.read(buf, { type: "buffer" })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return NextResponse.json({ error: "Empty workbook" }, { status: 400 })

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
  if (rows.length === 0) return NextResponse.json({ error: "No data rows" }, { status: 400 })

  const now    = new Date()
  let upserted = 0
  let skipped  = 0
  const duplicates: string[] = []

  const client = await clientPromise
  const coll   = client.db(DB).collection(COLL)

  for (const row of rows) {
    // ไฟล์ export ใหม่รวมชื่อ-นามสกุลไว้คอลัมน์เดียว · ไฟล์เก่ายังมีคอลัมน์ ชื่อ/นามสกุล แยก
    const split     = splitFullName(parseStr(row["ชื่อ-นามสกุล"]))
    const firstName = parseStr(row["ชื่อ"]) || split.firstName
    const lastName  = parseStr(row["นามสกุล"]) || split.lastName
    if (!firstName || !lastName) { skipped++; continue }

    const staffCode = parseStr(row["รหัสพนักงาน"])
    // ชื่อซ้ำกับคนอื่นในระบบ (ไม่ใช่แถวรหัสเดียวกันที่กำลังอัปเดต) → ข้าม
    if (await findDuplicateDriver(coll, firstName, lastName, staffCode ? { staffCode: { $ne: staffCode } } : {})) {
      skipped++; duplicates.push(`${firstName} ${lastName}`); continue
    }

    const doc = {
      firstName,
      lastName,
      birthDate:    parseStr(row["วันเกิด (YYYY-MM-DD)"]),
      nationalId:   parseStr(row["เลขบัตรประชาชน"]),
      phone:        parseStr(row["เบอร์โทรศัพท์"]),
      fleet:        parseStr(row["Fleet"]),
      plant:        parseStr(row["Plant"]),
      address:      parseStr(row["ที่อยู่"]),
      startDate:    parseStr(row["เริ่มงาน (YYYY-MM-DD)"]),
      endDate:      parseStr(row["สิ้นสุด (YYYY-MM-DD)"]),
      isDriver:     parseBool(row["พนักงานขับรถ (TRUE/FALSE)"]),
      isTruckOwner: parseBool(row["เจ้าของรถ (TRUE/FALSE)"]),
      staffCode,
      status:       ["inactive"].includes(String(row["สถานะ (active/inactive)"] ?? "").trim())
                      ? "inactive" : "active",
      updatedAt: now,
    }

    if (staffCode) {
      // Upsert by staffCode when present
      await coll.updateOne(
        { staffCode },
        { $set: doc, $setOnInsert: { createdAt: now } },
        { upsert: true }
      )
    } else {
      // No staffCode — always insert
      await coll.insertOne({ ...doc, createdAt: now })
    }
    upserted++
  }

  return NextResponse.json({ ok: true, upserted, skipped, duplicates })
}
