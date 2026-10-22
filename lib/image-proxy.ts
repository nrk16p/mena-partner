/**
 * ย่อรูปเองแทนตัวย่อรูปของ Vercel (/_next/image)
 * เหตุผล: โควตาย่อรูปฟรีของ Vercel หมด → ตอบ 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED
 * รูปบน /trucks หายทั้งหน้า (2026-10-22) — ย่อด้วย sharp ใน /api/public/img แล้วให้ CDN จำไว้แทน
 *
 * ใช้ร่วมกันทั้ง loader (ฝั่งเบราว์เซอร์) และ route (ฝั่งเซิร์ฟเวอร์) — ห้าม import ของฝั่งเซิร์ฟเวอร์ในไฟล์นี้
 */

/** ชุดความกว้างเดียวกับค่าเริ่มต้นของ next/image (imageSizes + deviceSizes ใน Next 16) */
export const ALLOWED_WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]

/** bucket DO Spaces ของเรา (รูปรถ/เอกสาร) — โฮสต์อื่นไม่ย่อให้ กันคนนอกยืมใช้ */
const REMOTE_HOSTS = new Set([
  "mn-bucket.sgp1.digitaloceanspaces.com",
  "mn-bucket.sgp1.cdn.digitaloceanspaces.com",
])

const isSvg = (path: string) => path.split("?")[0].toLowerCase().endsWith(".svg")

/** รูปนี้ส่งผ่าน route ย่อรูปได้ไหม (ไม่ได้ = ใช้ต้นฉบับตรง ๆ) */
export function isProxiable(src: string): boolean {
  if (src.startsWith("/")) {
    return src.startsWith("/brand/") && !src.includes("..") && !src.includes("//") && !isSvg(src)
  }
  let u: URL
  try { u = new URL(src) } catch { return false }
  return u.protocol === "https:" && REMOTE_HOSTS.has(u.hostname)
    && !u.username && !u.password && !u.port && !isSvg(u.pathname)
}

export type ImageRequest =
  | { ok: true; source: string; width: number }
  | { ok: false; error: string }

/** ตรวจ query ของ /api/public/img?url=…&w=… */
export function parseImageRequest(params: URLSearchParams): ImageRequest {
  const url = params.get("url")
  if (!url || !isProxiable(url)) return { ok: false, error: "url ไม่อนุญาต" }
  const w = Number(params.get("w"))
  if (!Number.isInteger(w) || !ALLOWED_WIDTHS.includes(w)) return { ok: false, error: "ความกว้างไม่อนุญาต" }
  return { ok: true, source: url, width: w }
}
