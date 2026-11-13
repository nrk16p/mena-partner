import { describe, it, expect } from "vitest"
import { toPosterData } from "@/lib/catalog-poster-data"
import type { CatalogVehicle } from "@/lib/catalog-pdf"
import type { CatalogConfig } from "@/lib/catalog-config"

// โปสเตอร์เปิดได้เฉพาะคนล็อกอิน (Google OAuth) จึงทดสอบที่ข้อมูลแทนการเปิดหน้าเว็บ
const cfg = { sellingPoints: [], tagline: "", contactPhone: "", contactLine: "" } as unknown as CatalogConfig

const vehicle = (p: Partial<CatalogVehicle>): CatalogVehicle => ({
  licensePlate: "สบ.70-6298", truckNumber: "ME135", brand: "NISSAN", model: "CWM454HMRA", hasPrice: true, ...p,
})

describe("toPosterData — ตัวเลขบนโปสเตอร์", () => {
  it("ตัวเลขตรงกับ price-list ไม่ปัด (เลิกปัด 2026-11-13)", () => {
    const d = toPosterData(vehicle({
      totalSalePrice: 1335728, downPayment: 100000, monthlyPayment: 17163, financeInstallments: 72,
    }), cfg)
    expect(d.price).toBe(1335728)
    expect(d.monthlyPayment).toBe(17163)
    expect(d.downPayment).toBe(100000)
  })

  it("ไม่มีดาวน์จริง → ไม่โชว์บรรทัดดาวน์", () => {
    const d = toPosterData(vehicle({
      totalSalePrice: 1238400, downPayment: 0, monthlyPayment: 17200, financeInstallments: 72,
    }), cfg)
    expect(d.price).toBe(1238400)
    expect(d.downPayment).toBeUndefined()
  })
})
