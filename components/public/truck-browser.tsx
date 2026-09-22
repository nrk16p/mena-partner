"use client"

import { useMemo, useState } from "react"
import { TruckCard } from "./truck-card"
import type { PublicTruck } from "@/lib/public-trucks"

type Sort = "recommended" | "price-asc" | "year-desc"

/** กรองในหน่วยความจำ — สต็อกหลักสิบคัน ไม่ต้อง server pagination; ตัวกรองไม่เขียนลง URL (กันหน้าซ้ำถูก index) */
export function TruckBrowser({ trucks }: { trucks: PublicTruck[] }) {
  const [brand, setBrand] = useState("")
  const [characteristic, setChar] = useState("")
  const [maxPrice, setMaxPrice] = useState(0)
  const [sort, setSort] = useState<Sort>("recommended")

  const brands = useMemo(() => [...new Set(trucks.map((t) => t.brand).filter(Boolean))].sort(), [trucks])
  const chars  = useMemo(() => [...new Set(trucks.map((t) => t.characteristic).filter(Boolean))].sort(), [trucks])

  const shown = useMemo(() => {
    const out = trucks.filter((t) =>
      (!brand || t.brand === brand) &&
      (!characteristic || t.characteristic === characteristic) &&
      (!maxPrice || t.display.price <= maxPrice))
    if (sort === "price-asc") return [...out].sort((a, b) => a.display.price - b.display.price)
    if (sort === "year-desc") return [...out].sort((a, b) => (b.registrationYear ?? 0) - (a.registrationYear ?? 0))
    return out
  }, [trucks, brand, characteristic, maxPrice, sort])

  const sel = "rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
  return (
    <>
      <div className="flex flex-wrap gap-2 items-center mb-6">
        <select className={sel} value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">ยี่ห้อทั้งหมด</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={sel} value={characteristic} onChange={(e) => setChar(e.target.value)}>
          <option value="">ลักษณะทั้งหมด</option>
          {chars.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={sel} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
          <option value={0}>ราคาทุกช่วง</option>
          <option value={800000}>ไม่เกิน 800,000</option>
          <option value={1200000}>ไม่เกิน 1,200,000</option>
          <option value={1800000}>ไม่เกิน 1,800,000</option>
        </select>
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recommended">แนะนำ</option>
          <option value="price-asc">ราคาต่ำ → สูง</option>
          <option value="year-desc">ปีใหม่ → เก่า</option>
        </select>
        <span className="text-sm text-zinc-500 ml-auto">{shown.length} คัน</span>
      </div>
      {shown.length === 0 ? (
        <p className="text-zinc-500 py-12 text-center">ไม่พบรถตามเงื่อนไขนี้ — ลองล้างตัวกรอง</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => <TruckCard key={t.slug} truck={t} />)}
        </div>
      )}
    </>
  )
}
