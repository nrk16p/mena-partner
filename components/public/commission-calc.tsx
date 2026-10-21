"use client"

import { useState } from "react"
import { commissionTotal } from "@/lib/commission"

const MIN = 1
const MAX = 30

/** ลากดูว่าขายได้กี่คัน ได้ค่าคอมรวมเท่าไหร่ — สูตรเดียวกับหน้า /quotations/commission (ขั้นบันได คันเก่าไม่ปรับย้อน) */
export function CommissionCalc({ topSellerAt = 20, topSellerBonus = 5000 }: { topSellerAt?: number; topSellerBonus?: number }) {
  const [n, setN] = useState(7)
  const base = commissionTotal(n)
  const bonus = n >= topSellerAt ? topSellerBonus : 0
  const fmt = (v: number) => v.toLocaleString("th-TH")
  const step = "grid place-items-center h-11 w-11 shrink-0 rounded-full border border-white/40 text-2xl leading-none hover:bg-white/10 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-white"

  return (
    <div className="rounded-2xl bg-[var(--mena-green-deep)] text-white p-6 sm:p-8">
      <label htmlFor="calc-n" className="text-sm text-white/70">ถ้าขายได้</label>
      <p className="mt-1 text-4xl font-medium tabular-nums">{n} คัน</p>
      {/* มือถือลากแถบเล็ก ๆ ยาก → มีปุ่ม − / + ขนาดนิ้วกดข้าง ๆ */}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => setN((v) => Math.max(MIN, v - 1))} disabled={n <= MIN} aria-label="ลดจำนวนคัน" className={step}>−</button>
        <input
          id="calc-n" type="range" min={MIN} max={MAX} value={n} onChange={(e) => setN(Number(e.target.value))}
          className="h-11 flex-1 accent-white cursor-pointer"
        />
        <button type="button" onClick={() => setN((v) => Math.min(MAX, v + 1))} disabled={n >= MAX} aria-label="เพิ่มจำนวนคัน" className={step}>+</button>
      </div>
      <p className="mt-6 text-sm text-white/70">ได้ค่าคอมรวม</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">฿{fmt(base + bonus)}</p>
      {bonus > 0 && <p className="mt-1 text-sm text-white/80">รวมโบนัส Top Seller ฿{fmt(bonus)} แล้ว</p>}
    </div>
  )
}
