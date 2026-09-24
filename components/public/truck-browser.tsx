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
  const [yearFrom, setYearFrom] = useState(0)
  const [yearTo, setYearTo] = useState(0)
  const [sort, setSort] = useState<Sort>("recommended")

  const brands = useMemo(() => [...new Set(trucks.map((t) => t.brand).filter(Boolean))].sort(), [trucks])
  const chars  = useMemo(() => [...new Set(trucks.map((t) => t.characteristic).filter(Boolean))].sort(), [trucks])
  // ปีในตัวเลือก = ปีที่มีรถจริง (เก็บเป็น ค.ศ. แสดงเป็น พ.ศ.)
  const years  = useMemo(
    () => [...new Set(trucks.map((t) => t.registrationYear).filter((y): y is number => !!y))].sort((a, b) => a - b),
    [trucks])

  const shown = useMemo(() => {
    const out = trucks.filter((t) => {
      // ตั้งช่วงปีแล้ว รถที่ไม่ได้บันทึกปีจะไม่ขึ้น (ยืนยันปีไม่ได้)
      const y = t.registrationYear
      if ((yearFrom || yearTo) && !y) return false
      return (!brand || t.brand === brand) &&
        (!characteristic || t.characteristic === characteristic) &&
        (!maxPrice || t.display.price <= maxPrice) &&
        (!yearFrom || (y ?? 0) >= yearFrom) &&
        (!yearTo || (y ?? 0) <= yearTo)
    })
    if (sort === "price-asc") return [...out].sort((a, b) => a.display.price - b.display.price)
    if (sort === "year-desc") return [...out].sort((a, b) => (b.registrationYear ?? 0) - (a.registrationYear ?? 0))
    return out
  }, [trucks, brand, characteristic, maxPrice, yearFrom, yearTo, sort])

  const reset = () => { setBrand(""); setChar(""); setMaxPrice(0); setYearFrom(0); setYearTo(0); setSort("recommended") }
  const filtered = !!(brand || characteristic || maxPrice || yearFrom || yearTo)
  const sel = "rounded-full border border-[var(--mena-line)] bg-white px-4 py-2.5 text-sm hover:border-[var(--mena-green-soft)] focus-visible:outline-2 focus-visible:outline-[var(--mena-green)]"

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--mena-line)] pb-5 mb-8">
        <select className={sel} value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="ยี่ห้อ">
          <option value="">ยี่ห้อทั้งหมด</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {chars.length > 1 && (
          <select className={sel} value={characteristic} onChange={(e) => setChar(e.target.value)} aria-label="ลักษณะรถ">
            <option value="">ลักษณะทั้งหมด</option>
            {chars.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select className={sel} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} aria-label="ราคาไม่เกิน">
          <option value={0}>ราคาทุกช่วง</option>
          <option value={1_500_000}>ไม่เกิน 1.5 ล้าน</option>
          <option value={1_800_000}>ไม่เกิน 1.8 ล้าน</option>
          <option value={2_200_000}>ไม่เกิน 2.2 ล้าน</option>
        </select>
        {years.length > 1 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--mena-ink)]/55">
            ปีจดทะเบียน
            <select className={sel} value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value))} aria-label="ปีจดทะเบียนตั้งแต่">
              <option value={0}>ตั้งแต่</option>
              {years.filter((y) => !yearTo || y <= yearTo).map((y) => <option key={y} value={y}>{y + 543}</option>)}
            </select>
            ถึง
            <select className={sel} value={yearTo} onChange={(e) => setYearTo(Number(e.target.value))} aria-label="ปีจดทะเบียนถึง">
              <option value={0}>ล่าสุด</option>
              {years.filter((y) => !yearFrom || y >= yearFrom).map((y) => <option key={y} value={y}>{y + 543}</option>)}
            </select>
          </span>
        )}
        <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="เรียงลำดับ">
          <option value="recommended">แนะนำ</option>
          <option value="price-asc">ราคาต่ำไปสูง</option>
          <option value="year-desc">ปีใหม่ไปเก่า</option>
        </select>

        {filtered && (
          <button type="button" onClick={reset} className="text-sm text-[var(--mena-green)] underline underline-offset-4 px-2 py-2">
            ล้างตัวกรอง
          </button>
        )}
        <p className="ml-auto text-sm text-[var(--mena-ink)]/55">{shown.length} คัน</p>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[var(--mena-line)] py-16 text-center">
          <p className="font-medium">ไม่มีรถตรงเงื่อนไขนี้</p>
          <p className="text-sm text-[var(--mena-ink)]/60 mt-1">ลองกว้างขึ้น หรือโทรถามฝ่ายขายว่ามีคันไหนกำลังจะว่าง</p>
          <button type="button" onClick={reset} className="mt-4 rounded-full bg-[var(--mena-green)] text-white px-5 py-2.5 text-sm font-medium">
            ดูรถทั้งหมด
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => <TruckCard key={t.slug} truck={t} />)}
        </div>
      )}
    </>
  )
}
