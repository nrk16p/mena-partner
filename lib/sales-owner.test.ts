import { describe, it, expect } from "vitest"
import { actorOf, resolveSalesEmail } from "./sales-owner"

function fakeDb(people: { name: string; email?: string }[]) {
  return {
    collection: () => ({
      findOne: async (q: { name: { $regex: string } }) => {
        const re = new RegExp(q.name.$regex, "i")
        return people.find((p) => re.test(p.name)) ?? null
      },
    }),
  } as unknown as Parameters<typeof resolveSalesEmail>[0]
}

const me = { email: "admin@mena.co.th", name: "Admin" }

describe("resolveSalesEmail — เซลล์เจ้าของดีลแยกจากคนกดบันทึก", () => {
  it("ชื่อใน sales_people มีอีเมล → ใช้อีเมลนั้น แม้คนคีย์เป็นคนอื่น", async () => {
    const db = fakeDb([{ name: "K.Bally", email: "bally@mena.co.th" }])
    expect(await resolveSalesEmail(db, "K.Bally", me)).toBe("bally@mena.co.th")
    expect(await resolveSalesEmail(db, "k.bally", me)).toBe("bally@mena.co.th")
  })
  it("ชื่อตรงกับคนคีย์เอง → อีเมลคนคีย์", async () => {
    expect(await resolveSalesEmail(fakeDb([]), "Admin", me)).toBe("admin@mena.co.th")
  })
  it("ไม่รู้จักชื่อ / ชื่อว่าง → ว่าง", async () => {
    expect(await resolveSalesEmail(fakeDb([{ name: "K.Bally" }]), "K.Bally", me)).toBe("")
    expect(await resolveSalesEmail(fakeDb([]), "", me)).toBe("")
  })
  it("ชื่อมีอักขระพิเศษไม่ทำ regex พัง", async () => {
    expect(await resolveSalesEmail(fakeDb([{ name: "K.บอล (ERZ1)", email: "ball@mena.co.th" }]), "K.บอล (ERZ1)", me)).toBe("ball@mena.co.th")
  })
})

describe("actorOf", () => {
  it("ไม่มีชื่อ → ใช้ส่วนหน้าอีเมล", () => {
    expect(actorOf({ user: { email: "x@mena.co.th" } })).toEqual({ email: "x@mena.co.th", name: "x" })
  })
  it("ไม่มี session → unknown", () => {
    expect(actorOf(null)).toEqual({ email: "unknown", name: "unknown" })
  })
})
