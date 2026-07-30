import type { Db } from "mongodb"

/**
 * ล็อคงวดเงินเดือน — งวดที่ approved/locked แล้ว ห้ามแก้ข้อมูลต้นทางทุกชนิด
 * (ค่าเที่ยว/วันทำงาน/รับ-หักอื่น/ปรับปรุง/งวดเงินเดือน) ต้องตีกลับหรือปลดล็อคก่อน
 * ใช้: const locked = await monthClosed(db, month); if (locked) return NextResponse.json(closedError(month), { status: 423 })
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function monthClosed(db: Db | any, month: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}$/.test(month)) return false
  const doc = await db.collection("month_status").findOne({ month }, { projection: { phase: 1 } })
  return doc?.phase === "approved" || doc?.phase === "locked"
}

export const closedError = (month: string) => ({
  error: `งวด ${month} อนุมัติ/ปิดแล้ว — แก้ไขข้อมูลไม่ได้ (ตีกลับหรือปลดล็อคที่หน้าสรุปงวดก่อน)`,
})
