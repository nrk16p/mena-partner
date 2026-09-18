/**
 * เส้นทางที่เปิดสาธารณะ (ไม่ต้อง login) — ใช้ใน middleware
 * แคบที่สุดเท่าที่พอใช้: หน้าเว็บขายรถ + API สาธารณะ + ไฟล์ SEO
 */
const PUBLIC_EXACT = new Set(["/trucks", "/sitemap.xml", "/robots.txt"])
const PUBLIC_PREFIXES = ["/trucks/", "/api/public/", "/og/"]

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}
