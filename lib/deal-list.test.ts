import { describe, it, expect } from "vitest"
import { bucketOf, bucketStats, stageCounts, filterDeals, kpis, sortDeals, daysIn, STAGE_BUCKETS, type ListDeal } from "@/lib/deal-list"

const NOW = new Date("2026-09-24T00:00:00Z")
const ago = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString()

const rows: ListDeal[] = [
  { _id: "1", stage: "LEAD", stageEnteredAt: ago(3), totalSalePrice: 1_000_000, salesEmail: "an@x.co", salesName: "แอน" },
  { _id: "2", stage: "QUOTED", stageEnteredAt: ago(40), totalSalePrice: 1_200_000, nextFollowUpDate: "2026-09-20", salesName: "บี" },
  { _id: "3", stage: "RESERVED", stageEnteredAt: ago(10), totalSalePrice: 1_300_000, nextFollowUpDate: "2026-09-24", salesEmail: "an@x.co", salesName: "แอน" },
  { _id: "4", stage: "CONTRACT_SIGNED", stageEnteredAt: ago(60), totalSalePrice: 1_400_000, salesName: "บี" },
  { _id: "5", stage: "DELIVERED", stageEnteredAt: ago(5), totalSalePrice: 1_500_000, salesName: "แอน" },
  { _id: "6", stage: "ON_HOLD", stageEnteredAt: ago(50), totalSalePrice: 1_100_000, nextFollowUpDate: "2026-10-05", salesName: "บี" },
  { _id: "7", stage: "CLOSED_LOST", stageEnteredAt: ago(90), totalSalePrice: 900_000, salesName: "แอน" },
]

describe("จัดดีลเข้าช่องสถานะ (10 สถานะ แยกช่องละสถานะ — ผู้ใช้สั่ง 2026-10-23)", () => {
  it("แต่ละขั้นได้ช่องของตัวเอง และสถานะพิเศษแยกออกมา", () => {
    expect(bucketOf("LEAD")).toBe("LEAD")
    expect(bucketOf("CONTRACT_SIGNED")).toBe("CONTRACT_SIGNED")
    expect(bucketOf("ON_HOLD")).toBe("ON_HOLD")
    expect(bucketOf(undefined)).toBe("")
  })
  it("มีครบ 10 ช่อง เรียงตามลำดับขั้น พร้อมชื่อไทยและสีของด่าน", () => {
    expect(STAGE_BUCKETS.map((b) => b.key)).toEqual([
      "LEAD", "QUALIFIED", "QUOTED", "VIEWING_SCHEDULED", "RESERVED",
      "TRAINING", "CONTRACT_SCHEDULED", "CONTRACT_SIGNED", "DELIVERED", "COMPLETED_90D",
    ])
    expect(STAGE_BUCKETS[0].label).toBe("ผู้สนใจ")
    expect(STAGE_BUCKETS[0].color).toBe("var(--phase-1)")
    expect(STAGE_BUCKETS[9].color).toBe("var(--phase-5)")
  })
})

describe("ตัวนับด่าน", () => {
  it("นับจำนวนแยกรายขั้นย่อย", () => {
    const c = stageCounts(rows)
    expect(c.QUOTED).toBe(1)
    expect(c.VIEWING_SCHEDULED).toBeUndefined()   // ไม่มีดีลในขั้นนี้ = ไม่มีคีย์ (หน้าเว็บแทนด้วย 0)
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(rows.length)
  })

  it("นับจำนวนและมูลค่าตามด่าน", () => {
    const s = bucketStats(rows)
    expect(s.LEAD).toEqual({ count: 1, value: 1_000_000 })
    expect(s.CONTRACT_SIGNED).toEqual({ count: 1, value: 1_400_000 })
    expect(s.VIEWING_SCHEDULED).toEqual({ count: 0, value: 0 })
    expect(s.CLOSED_LOST.count).toBe(1)
  })

  // บั๊กที่ต้องกันไว้: เดิมกรองด่านที่ server แล้วเอาผลมานับ ด่านอื่นเลยเหลือ 0
  it("เลือกด่านแล้ว ตัวเลขของด่านอื่นต้องไม่เปลี่ยน", () => {
    const before = bucketStats(rows)
    const shown = filterDeals(rows, { bucket: "QUOTED" }, NOW)
    expect(shown.map((d) => d._id)).toEqual(["2"])
    expect(bucketStats(rows)).toEqual(before)
    expect(kpis(rows, NOW).total).toBe(7)
  })
})

// ลูกค้าจากฟอร์มบนเว็บ /trucks เคยถูกบันทึกโดยไม่มี stage → ไม่ตกช่องไหนเลย (ทั้งหมด 119 แต่รวมทุกช่องได้ 115 — 2026-10-23)
describe("ดีลที่ไม่มี stage (lead จากหน้าเว็บรุ่นเก่า)", () => {
  const web: ListDeal[] = [...rows, { _id: "8", totalSalePrice: 800_000 }]
  it("นับเป็นผู้สนใจ ทุกช่องรวมกันเท่าทั้งหมด", () => {
    const s = bucketStats(web)
    expect(s.LEAD.count).toBe(2)
    expect(Object.values(s).reduce((a, b) => a + b.count, 0)).toBe(web.length)
  })
  it("นับเป็นดีลที่ยังเดินอยู่ในมูลค่า pipeline", () => {
    expect(kpis(web, NOW).openCount).toBe(kpis(rows, NOW).openCount + 1)
  })
  it("กดช่องผู้สนใจแล้วเห็นดีลนี้", () => {
    expect(filterDeals(web, { bucket: "LEAD" }, NOW).map((d) => d._id)).toEqual(["1", "8"])
  })
})

describe("ตัวกรอง", () => {
  it("ดีลของฉัน: ใช้อีเมลก่อน ไม่มีอีเมลค่อยเทียบชื่อ", () => {
    const mine = filterDeals(rows, { mine: true, me: { email: "an@x.co", name: "แอน" } }, NOW)
    expect(mine.map((d) => d._id)).toEqual(["1", "3", "5", "7"])
  })
  it("ดีลของฉันต้องไม่กินดีลที่มอบให้เซลล์คนอื่น", () => {
    const mine = filterDeals(rows, { mine: true, me: { email: "bee@x.co", name: "บี" } }, NOW)
    expect(mine.map((d) => d._id)).toEqual(["2", "4", "6"])
  })
  it("ตัวกรองด่วน: ต้องติดตามวันนี้ (รวมที่เลยกำหนด) และค้างขั้นเกิน 30 วัน", () => {
    expect(filterDeals(rows, { quick: "followup" }, NOW).map((d) => d._id)).toEqual(["2", "3"])
    // ดีล 7 ปิดไปแล้ว ไม่นับว่าค้าง
    expect(filterDeals(rows, { quick: "stuck" }, NOW).map((d) => d._id)).toEqual(["2", "4", "6"])
  })
})

describe("KPI", () => {
  it("นับงานค้างติดตาม มูลค่าที่ยังไม่ปิด และรถที่ส่งมอบแล้ว", () => {
    const k = kpis(rows, NOW)
    expect(k).toMatchObject({ followUpToday: 2, followUpOverdue: 1, stuck: 3, delivered: 1, completed: 0 })
    // ยังไม่ปิด = ทุกใบที่ไม่ใช่ปิดดีล/ครบ 90 วัน (รวมพักติดตาม)
    expect(k.openCount).toBe(6)
    expect(k.openValue).toBe(7_500_000)
  })
})

describe("การเรียง", () => {
  it("นัดที่เลยกำหนดขึ้นก่อน แล้วค่อยดีลที่ไม่มีนัดเรียงตามวันค้าง", () => {
    expect(sortDeals(rows, NOW).map((d) => d._id)).toEqual(["2", "3", "6", "7", "4", "5", "1"])
    expect(daysIn(ago(12), NOW)).toBe(12)
  })
})
