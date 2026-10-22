import { isProxiable } from "./image-proxy"

/**
 * loader ของ next/image (ตั้งใน next.config images.loaderFile) — ดูเหตุผลใน lib/image-proxy.ts
 * รูปที่ย่อได้ → /api/public/img · ที่เหลือ (svg, โฮสต์อื่น) → ต้นฉบับตรง ๆ ไม่ให้รูปหาย
 */
export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (!isProxiable(src)) return src
  return `/api/public/img?url=${encodeURIComponent(src)}&w=${width}`
}
