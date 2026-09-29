/** ★★★★★ = พร้อมขาย (saleStatus ready) — ใช้ร่วม การ์ด / ตัวกรอง / หน้ารายละเอียด ให้หน้าตาเดียวกัน */
export function ReadyStars({ className = "" }: { className?: string }) {
  return (
    <span className={`tracking-[-0.08em] text-[#E0A800] ${className}`} aria-hidden="true">★★★★★</span>
  )
}

/** ป้าย "★★★★★ พร้อมขาย" แบบเม็ดยา — วางบนรูปการ์ด/หัวกล่องราคา */
export function ReadyBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/95 text-[var(--mena-green-deep)] text-xs font-medium px-3 py-1 shadow-sm ${className}`}>
      <ReadyStars />
      พร้อมขาย
    </span>
  )
}
