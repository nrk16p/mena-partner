import { describe, it, expect } from "vitest"
import { isPublicPath } from "@/lib/public-routes"

describe("isPublicPath", () => {
  it("เปิดเฉพาะเส้นทางสาธารณะที่ตั้งใจ", () => {
    for (const p of ["/trucks", "/trucks/me009-hino-fm2p-2561", "/api/public/trucks", "/og/truck/x", "/sitemap.xml", "/robots.txt"])
      expect(isPublicPath(p)).toBe(true)
  })

  it("หน้าระบบภายในต้องไม่หลุดเป็น public", () => {
    for (const p of ["/", "/drivers", "/payroll", "/vehicle-cost", "/catalog", "/api/drivers", "/api/contracts", "/api/upload", "/admin/users"])
      expect(isPublicPath(p)).toBe(false)
  })

  it("กันชื่อ path ที่ขึ้นต้นคล้ายกันแต่ไม่ใช่ของสาธารณะ", () => {
    expect(isPublicPath("/trucksecret")).toBe(false)
    expect(isPublicPath("/api/publicity")).toBe(false)
  })
})
