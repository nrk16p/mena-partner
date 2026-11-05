import { describe, it, expect } from "vitest"
import { looksLikeEmail, nameFromEmail } from "./sales-display"

describe("sales-display", () => {
  it("แยกอีเมลออกจากชื่อคน", () => {
    expect(looksLikeEmail("oum@mena.co.th")).toBe(true)
    expect(looksLikeEmail("Thanradee Taginnog (Oum)")).toBe(false)
  })
  it("เดาชื่อจากอีเมลเมื่อหาในระบบไม่เจอ", () => {
    expect(nameFromEmail("thanradee.t@mena.co.th")).toBe("Thanradee T")
    expect(nameFromEmail("oum_sales@gmail.com")).toBe("Oum Sales")
  })
})
