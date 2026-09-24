import { describe, it, expect, vi } from "vitest"

// lib/deal-cron นำเข้า "server-only" + mongo ได้ตอนรันจริง — เทสต์สนใจเฉพาะ logic ตัดสินใจ
vi.mock("server-only", () => ({}))

const { dealDailyActions } = await import("@/lib/deal-cron")

const NOW = new Date("2026-09-24T03:00:00Z")
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString()

describe("งานรายวันของไปป์ไลน์", () => {
  it("พักติดตามและเลยวันนัดแล้ว → ต้องเตือน", () => {
    expect(dealDailyActions({ stage: "ON_HOLD", nextFollowUpDate: "2026-09-20", lastActivityAt: daysAgo(3) }, NOW).followUpDue).toBe(true)
    expect(dealDailyActions({ stage: "ON_HOLD", nextFollowUpDate: "2026-10-20", lastActivityAt: daysAgo(3) }, NOW).followUpDue).toBe(false)
  })

  it("เงียบครบ 30 วัน → ปิดอัตโนมัติ · 29 วันยังไม่ปิด", () => {
    expect(dealDailyActions({ stage: "QUOTED", lastActivityAt: daysAgo(30) }, NOW).autoClose).toBe(true)
    expect(dealDailyActions({ stage: "QUOTED", lastActivityAt: daysAgo(29) }, NOW).autoClose).toBe(false)
  })

  it("ดีลที่พักติดตามก็โดนกฎ 30 วันเหมือนกัน", () => {
    expect(dealDailyActions({ stage: "ON_HOLD", lastActivityAt: daysAgo(45) }, NOW).autoClose).toBe(true)
  })

  it("ขั้นส่งมอบได้รับยกเว้นกฎ 30 วัน (กำลังรอครบ 90 วัน)", () => {
    const d = { stage: "DELIVERED", deliveredAt: daysAgo(40), lastActivityAt: daysAgo(40) }
    expect(dealDailyActions(d, NOW).autoClose).toBe(false)
    expect(dealDailyActions(d, NOW).complete).toBe(false)
  })

  it("ส่งมอบครบ 90 วัน → ขยับจบให้เอง", () => {
    const d = { stage: "DELIVERED", deliveredAt: daysAgo(90), lastActivityAt: daysAgo(90) }
    expect(dealDailyActions(d, NOW).complete).toBe(true)
    expect(dealDailyActions(d, NOW).autoClose).toBe(false)
  })

  it("ดีลที่ปิด/จบแล้ว ไม่ต้องทำอะไรอีก", () => {
    for (const stage of ["CLOSED_LOST", "COMPLETED_90D"]) {
      const r = dealDailyActions({ stage, lastActivityAt: daysAgo(400) }, NOW)
      expect([r.autoClose, r.complete, r.followUpDue]).toEqual([false, false, false])
    }
  })

  it("ไม่มีวันเคลื่อนไหวเลย → ถือว่าเงียบ (ปิดอัตโนมัติ)", () => {
    expect(dealDailyActions({ stage: "LEAD" }, NOW).autoClose).toBe(true)
  })
})
