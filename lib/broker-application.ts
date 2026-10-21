import { z } from "zod"

/**
 * ใบสมัครนายหน้า / เซลล์ขายรถร่วม — แปลงจากแบบฟอร์มกระดาษ (Reference_data/แบบฟอร์มใบสมัครเป็นนายหน้าขายรถร่วม.pdf)
 * หน้าเว็บสาธารณะ /sales-partner ส่งเข้า /api/public/broker-applications → collection broker_applications
 * ฝ่ายขายดู/อนุมัติที่ /quotations/brokers
 *
 * ไฟล์นี้ pure ไม่แตะ DB/env — ใช้ได้ทั้งหน้าเว็บ, route และ unit test
 */

export const BROKER_COLL = "broker_applications"

/** ศูนย์ที่สังกัด (ข้อ 3 ในใบกระดาษ) — ชื่อเต็มรอฝ่ายขายยืนยัน ตอนนี้ใช้ตัวย่อตามใบเดิม */
export const BROKER_CENTERS = [
  { key: "skt", label: "สกท." },
  { key: "ssb", label: "สสบ." },
  { key: "slb", label: "ศลบ." },
  { key: "other", label: "อื่น ๆ" },
] as const
export type BrokerCenter = (typeof BROKER_CENTERS)[number]["key"]
export const centerLabel = (key: string, other?: string) =>
  key === "other" ? (other?.trim() || "อื่น ๆ") : (BROKER_CENTERS.find((c) => c.key === key)?.label ?? key)

export const THAI_BANKS = [
  "กสิกรไทย", "กรุงเทพ", "กรุงไทย", "ไทยพาณิชย์", "กรุงศรีอยุธยา", "ทหารไทยธนชาต (ttb)",
  "ออมสิน", "ธ.ก.ส.", "อาคารสงเคราะห์", "ยูโอบี", "ซีไอเอ็มบี ไทย", "เกียรตินาคินภัทร", "แลนด์ แอนด์ เฮ้าส์",
] as const

export type BrokerStatus = "pending" | "approved" | "rejected"
export const BROKER_STATUS_LABEL: Record<BrokerStatus, string> = {
  pending: "รอตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
}

/** เลขบัตรประชาชนไทย: 13 หลัก + หลักสุดท้ายเป็นเลขตรวจสอบ (กันพิมพ์ตกหล่น/สลับหลัก) */
export function isThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(id[12])
}

const digits = (v: string) => v.replace(/\D/g, "")
const thaiPhone = /^0\d{8,9}$/

/** ตรวจทีละช่อง — ใช้ทั้งตอนออกจากช่องในฟอร์ม (บอกทันที) และตอนตรวจฝั่ง server · คืน "" = ผ่าน */
export const phoneError = (v: string) =>
  thaiPhone.test(digits(v)) ? "" : "เบอร์โทรไม่ถูกต้อง ใส่เป็นเบอร์ 10 หลัก เช่น 0812345678"
export const bankAccountError = (v: string) => {
  const n = digits(v).length
  return n >= 10 && n <= 15 ? "" : "เลขบัญชีไม่ถูกต้อง ใส่เฉพาะตัวเลข 10–15 หลัก"
}
export const nationalIdError = (v: string) =>
  isThaiNationalId(digits(v)) ? "" : "เลขบัตรประชาชนไม่ถูกต้อง ลองเช็กอีกรอบ"

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  nationalId: z.string().trim().max(30),
  address: z.string().trim().min(1).max(500),
  phone: z.string().trim().max(30),
  lineId: z.string().trim().max(60).default(""),
  position: z.string().trim().max(120).default(""),
  company: z.string().trim().max(160).default(""),
  bankAccountNo: z.string().trim().max(30),
  bankName: z.string().trim().min(1).max(80),
  bankAccountName: z.string().trim().min(1).max(160),
  center: z.enum(["skt", "ssb", "slb", "other"]),
  centerOther: z.string().trim().max(120).default(""),
  consentPdpa: z.literal(true),
  confirmTrue: z.literal(true),
  website: z.string().optional(),   // honeypot — คนจริงไม่เห็นช่องนี้
})

export interface BrokerApplicationInput {
  firstName: string
  lastName: string
  nationalId: string
  address: string
  phone: string
  lineId: string
  position: string
  company: string
  bankAccountNo: string
  bankName: string
  bankAccountName: string
  center: BrokerCenter
  centerOther: string
}

/** ฟอร์มสาธารณะ = ไม่มี auth → validate เข้ม ทิ้ง field ที่ไม่รู้จัก และบอกว่าช่องไหนผิดเป็นภาษาคน */
export function parseBrokerApplication(body: unknown):
  { ok: true; data: BrokerApplicationInput } | { ok: false; error: string; field?: string } {
  const b = (body ?? {}) as Record<string, unknown>
  if (b.website) return { ok: false, error: "rejected" }
  if (b.consentPdpa !== true) return { ok: false, error: "กรุณาติ๊กยินยอมให้บริษัทเก็บข้อมูลก่อนส่ง", field: "consentPdpa" }
  if (b.confirmTrue !== true) return { ok: false, error: "กรุณาติ๊กยืนยันว่าข้อมูลเป็นความจริงก่อนส่ง", field: "confirmTrue" }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "")
    const name: Record<string, string> = {
      firstName: "ชื่อ", lastName: "นามสกุล", address: "ที่อยู่", bankName: "ธนาคาร",
      bankAccountName: "ชื่อบัญชี", center: "ศูนย์ที่สังกัด",
    }
    return { ok: false, error: name[field] ? `กรุณากรอก${name[field]}` : "ข้อมูลไม่ครบ ลองเช็กอีกรอบ", field }
  }
  const v = parsed.data
  const nationalId = digits(v.nationalId)
  const phone = digits(v.phone)
  const bankAccountNo = digits(v.bankAccountNo)
  for (const [field, err] of [
    ["nationalId", nationalIdError(nationalId)],
    ["phone", phoneError(phone)],
    ["bankAccountNo", bankAccountError(bankAccountNo)],
  ] as const) if (err) return { ok: false, error: err, field }
  if (v.center === "other" && !v.centerOther) return { ok: false, error: "เลือกศูนย์ อื่น ๆ แล้ว กรุณาพิมพ์ชื่อศูนย์ด้วย", field: "centerOther" }

  return {
    ok: true,
    data: {
      firstName: v.firstName, lastName: v.lastName, nationalId, address: v.address,
      phone, lineId: v.lineId, position: v.position, company: v.company,
      bankAccountNo, bankName: v.bankName, bankAccountName: v.bankAccountName,
      center: v.center, centerOther: v.center === "other" ? v.centerOther : "",
    },
  }
}
