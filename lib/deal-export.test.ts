import { describe, it, expect } from "vitest"
import { dealExportRows } from "./deal-export"

describe("dealExportRows", () => {
  it("แปลงดีลเป็นแถว Excel พร้อมสถานะไทย เซลล์ และคนคีย์", () => {
    const rows = dealExportRows([{
      quotationNo: "QT-2611-001", stage: "VIEWING_SCHEDULED", customerName: "สมชาย", customerPhone: "0812345678",
      licensePlate: "71-1234", truckNumber: "MTM001", vehicleBrand: "HINO", vehicleModel: "FM",
      totalSalePrice: 1500000, monthlyPayment: 25000, financeInstallments: 48,
      salesName: "K.Bally", createdBy: { name: "Admin" }, createdAt: "2026-11-01T00:00:00Z",
      timeline: [{ at: "2026-11-02T00:00:00Z", action: "บันทึกกิจกรรม", note: "โทรแล้ว" }],
    }])
    expect(rows[0]["สถานะ"]).toBe("นัดดูรถ")
    expect(rows[0]["เซลล์"]).toBe("K.Bally")
    expect(rows[0]["คีย์โดย"]).toBe("Admin")
    expect(rows[0]["ราคาขาย"]).toBe(1500000)
    expect(rows[0]["หมายเหตุล่าสุด"]).toBe("โทรแล้ว")
  })
  it("ดีลเก่าไม่มี stage = ผู้สนใจ · ปิดไม่สำเร็จโชว์เหตุผล", () => {
    const rows = dealExportRows([{ quotationNo: "A" }, { quotationNo: "B", stage: "CLOSED_LOST", lossReasonLabel: "ราคาสูง" }])
    expect(rows[0]["สถานะ"]).toBe("ผู้สนใจ")
    expect(rows[1]["หมายเหตุล่าสุด"]).toBe("ราคาสูง")
  })
})
