/** ข้อความสรุปโปรโมชั่นของรถคันหนึ่ง (ใช้ในใบเสนอราคา) — pure, ใช้ร่วมกันระหว่าง /api/promotions/master และ API รถหลายคันในดีล */
export function promotionSummary(m: Record<string, unknown> | null | undefined): string {
  if (!m) return ""
  const n = (v: unknown) => (typeof v === "number" ? v : 0)
  const fm = (v: number) => v.toLocaleString("th-TH")
  const lines: string[] = []
  if (n(m.pro1TotalValue) > 0 || m.pro1Condition) {
    const cond = (m.pro1Condition as string) || "ฟรีค่างวด"
    lines.push(`ฟรีค่างวด (${cond})${n(m.pro1FreeCount) ? ` ฟรี ${m.pro1FreeCount} งวด` : ""}${n(m.pro1TotalValue) ? ` รวม ${fm(n(m.pro1TotalValue))} บาท` : ""}`)
  }
  if (n(m.pro2RepairBudget) > 0) lines.push(`ฟรีค่าซ่อมบำรุง วงเงิน ${fm(n(m.pro2RepairBudget))} บาท`)
  if (n(m.pro3AnnualPm) > 0) lines.push(`ฟรี PM (บำรุงรักษาเชิงป้องกัน) ${fm(n(m.pro3AnnualPm))} บาท/ปี ตลอดสัญญา`)
  return lines.join(" · ")
}
