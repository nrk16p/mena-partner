import sharp from "sharp"
import type { NextRequest } from "next/server"
import { parseImageRequest } from "@/lib/image-proxy"

export const runtime = "nodejs"

const MAX_BYTES = 30 * 1024 * 1024
const NO_STORE = { "Cache-Control": "no-store" }
// เบราว์เซอร์จำ 7 วัน · CDN ของ Vercel จำ 1 ปี (ย่อครั้งเดียวต่อรูปต่อขนาด) — URL รูปไม่ถูกเขียนทับ หมุน/อัปใหม่ได้ไฟล์ใหม่
const CACHE = "public, max-age=604800, s-maxage=31536000, stale-while-revalidate=86400"

/**
 * GET /api/public/img?url=<รูป>&w=<ความกว้าง> — ย่อรูปเป็น webp ให้ next/image (ผ่าน lib/image-loader)
 * รับเฉพาะ bucket ของเรา + /brand/* และความกว้างชุดของ next/image (lib/image-proxy)
 */
export async function GET(req: NextRequest) {
  const p = parseImageRequest(req.nextUrl.searchParams)
  if (!p.ok) return new Response(p.error, { status: 400, headers: NO_STORE })

  const src = p.source.startsWith("/") ? new URL(p.source, req.nextUrl.origin).toString() : p.source
  // ย่อไม่ได้ด้วยเหตุใดก็ตาม → ส่งไปรูปต้นฉบับ ช้ากว่าแต่รูปยังขึ้น
  const fallback = () => new Response(null, { status: 307, headers: { Location: src, ...NO_STORE } })

  let buf: Buffer
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return new Response("not found", { status: 404, headers: NO_STORE })
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return fallback()
    buf = Buffer.from(await res.arrayBuffer())
  } catch {
    return fallback()
  }

  try {
    const out = await sharp(buf)
      .rotate() // หมุนตาม EXIF (รูปจากมือถือ) เหมือนตัวย่อรูปเดิม
      .resize({ width: p.width, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer()
    return new Response(new Uint8Array(out), {
      headers: { "Content-Type": "image/webp", "Cache-Control": CACHE },
    })
  } catch {
    return fallback() // เช่น HEIC ที่ sharp อ่านไม่ได้
  }
}
