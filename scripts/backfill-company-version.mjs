/**
 * ตั้งเวอร์ชัน 1 ของข้อมูลบริษัท/ผู้ลงนาม แล้วผูกสัญญาเก่าทั้งหมดเข้ากับเวอร์ชันนั้น
 * (สัญญาที่สร้างหลังจากนี้จะจำเวอร์ชันตอนสร้างเอง)
 * ใช้: node scripts/backfill-company-version.mjs [--apply]
 */
import { config } from "dotenv"
import { MongoClient } from "mongodb"

config({ path: ".env.local", quiet: true })

const apply = process.argv.includes("--apply")
const uri = process.env.MONGO_URI
const dbName = process.env.MONGO_DB ?? "mena_partner"

const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 8000 })
const db = client.db(dbName)

const current = await db.collection("company_config").findOne({ _id: "default" })
const existingVersion = await db.collection("company_config_versions").findOne({})
const missing = await db.collection("contracts").countDocuments({ companyVersion: { $exists: false } })
console.log("ข้อมูลบริษัทปัจจุบัน:", current ? current.sellerSignatories : "(ยังไม่มีใน DB → ใช้ค่า default ในโค้ด)")
console.log("มีเวอร์ชันในประวัติแล้ว:", !!existingVersion, "| สัญญาที่ยังไม่มีเวอร์ชัน:", missing)

if (apply) {
  if (!existingVersion) {
    const v1 = {
      name: current?.name ?? "บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)",
      regNo: current?.regNo ?? "0195536000089",
      address: current?.address ?? "เลขที่ 280/8 หมู่ที่ 9 ตำบลทับกวาง อำเภอแก่งคอย จังหวัดสระบุรี",
      sellerSignatories: current?.sellerSignatories ?? ["นางสุวรรณา ขจรวุฒิเดช", "นางสาวพัชรีรัตน์ ขจรวุฒิเดชภัทร์"],
      witnesses: current?.witnesses ?? ["นางสาวนัชภัค ขจรวุฒิเดช", "นางสาวธัญรดี ตะกิ่นนอก"],
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "backfill (ชุดที่ใช้อยู่ก่อนทำระบบเวอร์ชัน)",
    }
    await db.collection("company_config_versions").insertOne({ ...v1 })
    await db.collection("company_config").updateOne({ _id: "default" }, { $set: v1 }, { upsert: true })
    console.log("สร้างเวอร์ชัน 1 แล้ว")
  }
  const r = await db.collection("contracts").updateMany({ companyVersion: { $exists: false } }, { $set: { companyVersion: 1 } })
  console.log("ผูกสัญญาเก่าเข้าเวอร์ชัน 1:", r.modifiedCount, "ใบ")
}
await client.close()
