/**
 * Export Excel พนักงานขับรถ (ผู้ใช้สั่ง 2026-11-23): ชื่อ+นามสกุลอยู่คอลัมน์เดียว ไม่มีคำนำหน้า + คอลัมน์อายุ
 * ไฟล์ export ใช้เป็นต้นแบบ import ด้วย → splitFullName แยกกลับเป็นชื่อ/นามสกุลตอน import
 */

/** คำนำหน้าที่อาจหลุดมาอยู่ในช่องชื่อ (ข้อมูลเก่า) — ตัดทิ้งตอน export */
const PREFIX = /^(นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss)\s*/i

export function fullNameNoPrefix(firstName?: string | null, lastName?: string | null): string {
  const first = String(firstName ?? "").trim().replace(PREFIX, "")
  return `${first} ${String(lastName ?? "").trim()}`.replace(/\s+/g, " ").trim()
}

/** "สมชาย ใจดี" → ชื่อ = คำแรก, นามสกุล = ที่เหลือ */
export function splitFullName(full?: string | null): { firstName: string; lastName: string } {
  const parts = String(full ?? "").trim().replace(PREFIX, "").split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }
}

/** อายุเต็มปี จากวันเกิด YYYY-MM-DD · ไม่มี/อ่านไม่ได้ = "" */
export function ageFrom(birthDate?: string | null, today: Date = new Date()): number | "" {
  if (!birthDate) return ""
  const b = new Date(birthDate)
  if (isNaN(b.getTime())) return ""
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age >= 0 && age < 120 ? age : ""
}
