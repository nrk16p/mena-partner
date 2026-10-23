import { describe, it, expect } from "vitest"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { config } from "@/middleware"

const runs = (url: string) => unstable_doesMiddlewareMatch({ config, url })

// ช่องโหว่ที่เจอตอน QA 2026-10-23: matcher ข้ามทุก path ที่ลงท้ายด้วยนามสกุลรูป/ฟอนต์
// ต่อ ".png" ท้าย /api/... ก็ข้ามการตรวจล็อกอินและสิทธิ์ทั้งหมด (PUT /api/payroll/2026-07/X.png ไม่ล็อกอินก็เขียนได้)
describe("middleware matcher", () => {
  it("API ทุก path ต้องผ่าน middleware แม้ลงท้ายด้วยนามสกุลไฟล์", () => {
    for (const url of [
      "/api/contracts",
      "/api/payroll/2026-07/X.png",
      "/api/repair-monthly/x.png",
      "/api/debt-acceptances/x.jpg",
      "/api/drivers/abc.webp",
      "/api/x.woff2",
      "/api/quotations/abc.svg",
    ]) expect(runs(url), url).toBe(true)
  })
  it("หน้าในระบบยังผ่าน middleware", () => {
    for (const url of ["/payroll", "/quotations", "/contracts/abc"]) expect(runs(url), url).toBe(true)
  })
  it("ไฟล์นิ่ง (รูป/ฟอนต์ใน public, _next/static) ไม่ต้องผ่าน middleware", () => {
    for (const url of ["/brand/fleet-hero.webp", "/brand/mena-logo.svg", "/_next/static/chunks/app.js", "/favicon.ico"])
      expect(runs(url), url).toBe(false)
  })
})
