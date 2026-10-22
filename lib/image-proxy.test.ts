import { describe, it, expect } from "vitest"
import { isProxiable, parseImageRequest, ALLOWED_WIDTHS } from "@/lib/image-proxy"
import imageLoader from "@/lib/image-loader"

const SPACES = "https://mn-bucket.sgp1.digitaloceanspaces.com/media/abc/1241/webp/1947.webp"

describe("isProxiable", () => {
  it("รับรูปจาก bucket ของเรา และรูปใน /brand", () => {
    expect(isProxiable(SPACES)).toBe(true)
    expect(isProxiable("https://mn-bucket.sgp1.cdn.digitaloceanspaces.com/x.jpg")).toBe(true)
    expect(isProxiable("/brand/fleet-hero.webp")).toBe(true)
  })
  it("ไม่รับ svg, data:, โฮสต์อื่น, path แปลก ๆ", () => {
    expect(isProxiable("/brand/mena-logo.svg")).toBe(false)
    expect(isProxiable("data:image/png;base64,xxx")).toBe(false)
    expect(isProxiable("https://evil.example.com/a.jpg")).toBe(false)
    expect(isProxiable("https://other-bucket.sgp1.digitaloceanspaces.com/a.jpg")).toBe(false)
    expect(isProxiable("http://mn-bucket.sgp1.digitaloceanspaces.com/a.jpg")).toBe(false)
    expect(isProxiable("/api/secret")).toBe(false)
    expect(isProxiable("/brand/../api/x")).toBe(false)
    expect(isProxiable("//evil.example.com/brand/a.jpg")).toBe(false)
  })
})

describe("parseImageRequest", () => {
  const q = (o: Record<string, string>) => new URLSearchParams(o)

  it("ค่าถูกต้อง → ok", () => {
    expect(parseImageRequest(q({ url: SPACES, w: "640" }))).toEqual({ ok: true, source: SPACES, width: 640 })
  })
  it("ความกว้างต้องอยู่ในชุดที่ next/image ใช้", () => {
    expect(parseImageRequest(q({ url: SPACES, w: "641" })).ok).toBe(false)
    expect(parseImageRequest(q({ url: SPACES, w: "abc" })).ok).toBe(false)
    expect(parseImageRequest(q({ url: SPACES })).ok).toBe(false)
  })
  it("url ที่ไม่อนุญาต → ไม่ ok", () => {
    expect(parseImageRequest(q({ url: "https://evil.example.com/a.jpg", w: "640" })).ok).toBe(false)
    expect(parseImageRequest(q({ w: "640" })).ok).toBe(false)
  })
})

describe("imageLoader", () => {
  it("รูปที่ย่อได้ → ชี้ไป route ย่อรูปของเรา พร้อมความกว้าง", () => {
    const out = imageLoader({ src: SPACES, width: 640 })
    expect(out).toBe(`/api/public/img?url=${encodeURIComponent(SPACES)}&w=640`)
    const back = new URL(out, "https://x.test").searchParams
    expect(parseImageRequest(back)).toEqual({ ok: true, source: SPACES, width: 640 })
  })
  it("รูปที่ย่อไม่ได้ → ส่งต้นฉบับตรง ๆ (ยังขึ้น ไม่หาย)", () => {
    expect(imageLoader({ src: "https://evil.example.com/a.jpg", width: 640 })).toBe("https://evil.example.com/a.jpg")
  })
  it("ทุกความกว้างที่ next/image ขอ ผ่าน parse ได้", () => {
    for (const w of ALLOWED_WIDTHS) {
      const back = new URL(imageLoader({ src: "/brand/fleet-hero.webp", width: w }), "https://x.test").searchParams
      expect(parseImageRequest(back).ok).toBe(true)
    }
  })
})
