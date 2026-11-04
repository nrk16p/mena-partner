import { describe, it, expect } from "vitest"
import {
  commissionForNth, commissionTotal, nextTierInfo, buildSalesCommission, wonDateOf,
  type CommissionQuote,
} from "@/lib/commission"

describe("commissionForNth — อัตราตามขั้นบันได", () => {
  it("คันที่ 1-5 ได้ 2,000", () => {
    expect(commissionForNth(1)).toBe(2000)
    expect(commissionForNth(5)).toBe(2000)
  })
  it("คันที่ 6-10 ได้ 3,500", () => {
    expect(commissionForNth(6)).toBe(3500)
    expect(commissionForNth(10)).toBe(3500)
  })
  it("คันที่ 11-15 ได้ 4,000", () => {
    expect(commissionForNth(11)).toBe(4000)
    expect(commissionForNth(15)).toBe(4000)
  })
  it("คันที่ 16 เป็นต้นไปได้ 5,000 คงที่", () => {
    expect(commissionForNth(16)).toBe(5000)
    expect(commissionForNth(20)).toBe(5000)
    expect(commissionForNth(21)).toBe(5000)
    expect(commissionForNth(50)).toBe(5000)
  })
  it("ค่าที่ไม่ถูกต้องได้ 0", () => {
    expect(commissionForNth(0)).toBe(0)
    expect(commissionForNth(-3)).toBe(0)
  })
})

describe("commissionTotal — ยอดสะสม", () => {
  it("ตรงกับตารางที่ตกลงกันไว้", () => {
    expect(commissionTotal(0)).toBe(0)
    expect(commissionTotal(1)).toBe(2000)
    expect(commissionTotal(5)).toBe(10000)
    expect(commissionTotal(7)).toBe(17000)
    expect(commissionTotal(10)).toBe(27500)
    expect(commissionTotal(15)).toBe(47500)
    expect(commissionTotal(16)).toBe(52500)
    expect(commissionTotal(20)).toBe(72500)
  })
  it("เกิน 20 คันเพิ่มคันละ 5,000", () => {
    expect(commissionTotal(21)).toBe(77500)
    expect(commissionTotal(25)).toBe(97500)
  })
})

describe("nextTierInfo — อีกกี่คันถึงขั้นถัดไป", () => {
  it("ยังไม่ขายเลย เหลืออีก 5 คันขึ้นเป็น 3,500", () => {
    expect(nextTierInfo(0)).toEqual({ carsToNext: 5, nextRate: 3500 })
  })
  it("ขาย 4 คัน เหลืออีก 1 คัน", () => {
    expect(nextTierInfo(4)).toEqual({ carsToNext: 1, nextRate: 3500 })
  })
  it("ขาย 5 คัน — คันถัดไปได้ 3,500 แล้ว ขั้นที่จะขึ้นอีกทีคือ 4,000 ในอีก 5 คัน", () => {
    expect(nextTierInfo(5)).toEqual({ carsToNext: 5, nextRate: 4000 })
  })
  it("ขาย 10 คัน — อีก 5 คันขึ้นเป็น 5,000 (ขั้นสุดท้าย)", () => {
    expect(nextTierInfo(10)).toEqual({ carsToNext: 5, nextRate: 5000 })
  })
  it("ถึงอัตราสูงสุดแล้วไม่มีขั้นถัดไป", () => {
    expect(nextTierInfo(15)).toBeNull()
    expect(nextTierInfo(30)).toBeNull()
  })
})

const q = (o: Partial<CommissionQuote>): CommissionQuote => ({
  quotationNo: "QT-1", status: "won", totalSalePrice: 1_000_000, ...o,
})

describe("wonDateOf — วันปิดการขาย", () => {
  it("ใช้ event ปิดการขายใน timeline ก่อน", () => {
    const doc = q({
      updatedAt: "2026-08-20T00:00:00Z",
      timeline: [
        { at: "2026-08-01T00:00:00Z", by: "a", action: "สร้างใบเสนอ" },
        { at: "2026-08-05T00:00:00Z", by: "a", action: "เปลี่ยนสถานะ → ปิดการขาย" },
      ],
    })
    expect(wonDateOf(doc)).toBe("2026-08-05T00:00:00Z")
  })
  it("ไม่มี event ปิดการขาย → ใช้ updatedAt", () => {
    expect(wonDateOf(q({ updatedAt: "2026-08-09T00:00:00Z" }))).toBe("2026-08-09T00:00:00Z")
  })
})

describe("buildSalesCommission", () => {
  it("นับเฉพาะใบ won และเรียงตามวันปิดการขาย", () => {
    const rows = [
      q({ quotationNo: "B", salesEmail: "oum@x.com", salesName: "Oum", updatedAt: "2026-08-02T00:00:00Z" }),
      q({ quotationNo: "A", salesEmail: "oum@x.com", salesName: "Oum", updatedAt: "2026-08-01T00:00:00Z" }),
      q({ quotationNo: "C", salesEmail: "oum@x.com", salesName: "Oum", status: "quoted", updatedAt: "2026-08-03T00:00:00Z" }),
    ]
    const [rep] = buildSalesCommission(rows)
    expect(rep.count).toBe(2)
    expect(rep.sales.map((s) => s.quotationNo)).toEqual(["A", "B"])
    expect(rep.sales[0].nth).toBe(1)
    expect(rep.total).toBe(4000)
    expect(rep.sales[1].cumulative).toBe(4000)
  })

  it("จัดกลุ่มด้วย email — ชื่อสะกดต่างกันยังเป็นคนเดียวกัน", () => {
    const rows = [
      q({ quotationNo: "A", salesEmail: "Oum@X.com", salesName: "Oum", updatedAt: "2026-08-01T00:00:00Z" }),
      q({ quotationNo: "B", salesEmail: "oum@x.com", salesName: "Oum (Sales)", updatedAt: "2026-08-02T00:00:00Z" }),
    ]
    const out = buildSalesCommission(rows)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(2)
  })

  it("ใบที่ไม่มีผู้ขายแยกเป็นกลุ่มไม่ระบุ และอยู่ท้ายสุด", () => {
    const rows = [
      q({ quotationNo: "X", updatedAt: "2026-08-01T00:00:00Z" }),
      q({ quotationNo: "A", salesEmail: "oum@x.com", salesName: "Oum", updatedAt: "2026-08-02T00:00:00Z" }),
      q({ quotationNo: "B", salesEmail: "oum@x.com", salesName: "Oum", updatedAt: "2026-08-03T00:00:00Z" }),
    ]
    const out = buildSalesCommission(rows)
    expect(out.map((r) => r.unassigned)).toEqual([false, true])
    expect(out[1].name).toBe("ไม่ระบุผู้ขาย")
    expect(out[1].count).toBe(1)
  })

  it("อัตราปัจจุบันคืออัตราของคันถัดไป", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      q({ quotationNo: `Q${i}`, salesEmail: "a@x.com", salesName: "A", updatedAt: `2026-08-0${i + 1}T00:00:00Z` }))
    const [rep] = buildSalesCommission(rows)
    expect(rep.count).toBe(5)
    expect(rep.total).toBe(10000)
    expect(rep.currentRate).toBe(3500)
    expect(rep.next).toEqual({ carsToNext: 5, nextRate: 4000 })
  })
})

describe("รอบจ่ายค่าคอม — 30 วัน 1,000 · 90 วันส่วนที่เหลือ · ตัดรอบวันที่ 20", async () => {
  const { cycleOf, cycleLabel, payoutsOf, contractStartOf, isWonQuote, addDays } = await import("@/lib/commission")
  it("cycleOf: ถึงวันที่ 20 = เดือนนั้น หลังวันที่ 20 = เดือนถัดไป (ข้ามปีได้)", () => {
    expect(cycleOf("2026-11-20")).toBe("2026-11")
    expect(cycleOf("2026-11-21")).toBe("2026-12")
    expect(cycleOf("2026-12-25")).toBe("2027-01")
    expect(cycleLabel("2026-11")).toBe("รอบ 20 พ.ย. 69")
    expect(addDays("2026-10-01", 30)).toBe("2026-10-31")
  })
  it("payoutsOf: 2,000 → งวด 1 1,000 ครบ 30 วัน · งวด 2 1,000 ครบ 90 วัน", () => {
    const p = payoutsOf(2000, "2026-10-01")
    expect(p).toHaveLength(2)
    expect(p[0]).toMatchObject({ tranche: 1, amount: 1000, due: "2026-10-31", cycle: "2026-11" })
    expect(p[1]).toMatchObject({ tranche: 2, amount: 1000, due: "2026-12-30", cycle: "2027-01" })
    expect(payoutsOf(5000, "2026-10-01")[1].amount).toBe(4000)
    expect(payoutsOf(0, "2026-10-01")).toEqual([])
  })
  it("payoutsOf: ใส่ร่องรอยจ่ายแล้วตามงวด", () => {
    const mark = { paymentId: "p1", paidAt: "2026-11-20", amount: 1000, cycle: "2026-11" }
    const p = payoutsOf(3500, "2026-10-01", { t1: mark })
    expect(p[0].paid).toEqual(mark)
    expect(p[1].paid).toBeUndefined()
  })
  it("contractStartOf: ตั้งเอง > ขยับเป็นเซ็นสัญญา > วันนัดเซ็น > วันปิดการขาย", () => {
    const base = { quotationNo: "Q", status: "won", updatedAt: "2026-09-09T00:00:00Z" }
    expect(contractStartOf({ ...base, contractStartDate: "2026-10-05", contractSignedAt: "2026-10-01T03:00:00Z" })).toBe("2026-10-05")
    expect(contractStartOf({ ...base, contractSignedAt: "2026-10-01T03:00:00Z", contractDate: "2026-09-28" })).toBe("2026-10-01")
    expect(contractStartOf({ ...base, contractDate: "2026-09-28" })).toBe("2026-09-28")
    expect(contractStartOf(base)).toBe("2026-09-09")
  })
  it("isWonQuote: status won หรือขั้นเซ็นสัญญาขึ้นไป", () => {
    expect(isWonQuote({ status: "won" })).toBe(true)
    expect(isWonQuote({ status: "booked", stage: "CONTRACT_SIGNED" })).toBe(true)
    expect(isWonQuote({ status: "booked", stage: "RESERVED" })).toBe(false)
  })
  it("buildSalesCommission: ใบชื่ออย่างเดียวรวมเข้ากลุ่มอีเมลที่ชื่อเดียวกัน + paid/due รวม", async () => {
    const { buildSalesCommission } = await import("@/lib/commission")
    const rows = buildSalesCommission([
      { _id: "a", quotationNo: "Q1", status: "won", salesEmail: "b@x.com", salesName: "K.Bally", contractStartDate: "2026-08-01",
        commissionPayouts: { t1: { paymentId: "p", paidAt: "2026-09-20", amount: 1000, cycle: "2026-09" } } },
      { _id: "b", quotationNo: "Q2", status: "booked", stage: "DELIVERED", salesEmail: "", salesName: "k.bally", contractStartDate: "2026-09-01" },
    ], "2026-11-04")
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(2)
    expect(rows[0].paidTotal).toBe(1000)
    // Q1 งวด2 ครบ 2026-10-30 → รอบ 11 (ถึงกำหนด) · Q2 งวด1 ครบ 2026-10-01 → รอบ 10 · งวด2 ครบ 2026-11-30 → รอบ 12 (ยังไม่ถึง)
    expect(rows[0].dueTotal).toBe(2000)
  })
})
