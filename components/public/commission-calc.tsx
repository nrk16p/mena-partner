"use client"

import { useState } from "react"
import { commissionTotal } from "@/lib/commission"

/** ลากดูว่าขายได้กี่คัน ได้ค่าคอมรวมเท่าไหร่ — สูตรเดียวกับหน้า /quotations/commission (ขั้นบันได คันเก่าไม่ปรับย้อน) */
export function CommissionCalc({ topSellerAt = 20, topSellerBonus = 5000 }: { topSellerAt?: number; topSellerBonus?: number }) {
  const [n, setN] = useState(7)
  const base = commissionTotal(n)
  const bonus = n >= topSellerAt ? topSellerBonus : 0
  const fmt = (v: number) => v.toLocaleString("th-TH")

  return (
    <div className="rounded-2xl bg-[var(--mena-green-deep)] text-white p-6 sm:p-8">
      <label htmlFor="calc-n" className="text-sm text-white/70">ถ้าขายได้</label>
      <p className="mt-1 text-4xl font-medium tabular-nums">{n} คัน</p>
      <input
        id="calc-n" type="range" min={1} max={30} value={n} onChange={(e) => setN(Number(e.target.value))}
        className="mt-4 w-full accent-white"
      />
      <p className="mt-6 text-sm text-white/70">ได้ค่าคอมรวม</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">฿{fmt(base + bonus)}</p>
      {bonus > 0 && <p className="mt-1 text-sm text-white/80">รวมโบนัส Top Seller ฿{fmt(bonus)} แล้ว</p>}
    </div>
  )
}
