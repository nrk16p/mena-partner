"use client"

import { useState } from "react"
import { Search, FileText, Star, X, Plus } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import { confirm } from "@/components/ui/confirm"
import { optionsOf, type VehicleOption } from "@/lib/deal-vehicles"

interface PriceLite { licensePlate: string; status: string; vehicleBrand?: string; vehicleModel?: string; truckNumber?: string; totalSalePrice: number; monthlyPayment: number }

/**
 * ดีลเดียวเสนอรถได้หลายคัน — คันหลักอยู่ในการ์ด "รถ & ราคา" ด้านบน
 * บล็อกนี้ = คันอื่นที่เสนอให้ลูกค้าเลือก: ออก PDF แยกคัน / ตั้งเป็นคันหลัก / ถอด / เพิ่มคัน
 */
export function DealVehicleOptions({ dealId, deal, prices, busy, onChanged, onError }: {
  dealId: string
  deal: { licensePlate?: string; vehicles?: VehicleOption[] }
  prices: PriceLite[]
  busy: boolean
  onChanged: (doc: unknown) => void
  onError: (msg: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState("")
  const [working, setWorking] = useState(false)
  const options = optionsOf(deal)
  const norm = (s: string) => s.replace(/[\s.\-]/g, "").toLowerCase()
  const taken = new Set([norm(deal.licensePlate ?? ""), ...options.map((v) => norm(v.licensePlate))])
  const matches = q.trim()
    ? prices.filter((p) => !taken.has(norm(p.licensePlate)) && norm(`${p.licensePlate}${p.truckNumber ?? ""}`).includes(norm(q))).slice(0, 12)
    : []

  async function act(action: "add" | "remove" | "primary", licensePlate: string) {
    setWorking(true)
    try {
      const r = await fetch(`/api/quotations/${dealId}/vehicles`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, licensePlate }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { onError(d.error ?? "ทำรายการไม่สำเร็จ"); return }
      onChanged(d)
      if (action === "add") { setQ(""); setAdding(false) }
    } finally { setWorking(false) }
  }

  const disabled = busy || working
  return (
    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[13px] font-semibold">
          รถคันอื่นที่เสนอ <span className="text-zinc-400 font-normal">({options.length})</span>
          <span className="block text-[11px] font-normal text-zinc-500">ลูกค้า 1 คน = 1 ดีล เสนอได้หลายคัน ออกใบเสนอแยกคัน พอลูกค้าเลือกค่อยตั้งคันนั้นเป็นคันหลัก</span>
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)} disabled={disabled}
            className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-semibold border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> เพิ่มคัน
          </button>
        )}
      </div>

      {adding && (
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ทะเบียนหรือเบอร์รถ แล้วเลือกคันที่จะเสนอเพิ่ม"
            onKeyDown={(e) => { if (e.key === "Escape") { setAdding(false); setQ("") } }}
            className="w-full h-9 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-9 bg-white dark:bg-zinc-900" />
          <button onClick={() => { setAdding(false); setQ("") }} aria-label="ปิดช่องค้นหา" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400"><X className="w-4 h-4" /></button>
          {matches.length > 0 && (
            <div className="absolute z-20 left-0 right-0 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-lg">
              {matches.map((p) => (
                <button key={p.licensePlate} disabled={disabled} onClick={() => act("add", p.licensePlate)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex justify-between gap-3 disabled:opacity-50">
                  <span className="font-medium">
                    {p.licensePlate}{p.truckNumber && <span className="text-zinc-500 font-normal"> · {p.truckNumber}</span>}
                    {p.status === "contract" && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">มีสัญญาแล้ว</span>}
                  </span>
                  <span className="text-zinc-500 text-xs whitespace-nowrap">{p.vehicleBrand} · {formatMoney(p.totalSalePrice)}</span>
                </button>
              ))}
            </div>
          )}
          {q.trim() && matches.length === 0 && <p className="text-[11px] text-zinc-500 mt-1">ไม่พบคันที่ค้น (หรืออยู่ในดีลแล้ว)</p>}
        </div>
      )}

      {options.length === 0 ? (
        !adding && <p className="text-[13px] text-zinc-500">ยังไม่มีคันอื่น — กด &ldquo;เพิ่มคัน&rdquo; ถ้าลูกค้ากำลังเลือกระหว่างหลายคัน</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg">
          {options.map((v) => (
            <li key={v.licensePlate} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {v.licensePlate}
                  <span className="text-zinc-500 font-normal"> · {[v.vehicleBrand, v.vehicleModel].filter(Boolean).join(" ") || "-"}{v.truckNumber ? ` · ${v.truckNumber}` : ""}</span>
                </p>
                <p className="text-[12px] text-zinc-500 tabular-nums">
                  ราคา {formatMoney(v.totalSalePrice)} · ดาวน์ {formatMoney(v.downPayment)} · ค่างวด {formatMoney(v.monthlyPayment)} × {v.financeInstallments} งวด
                </p>
              </div>
              <a href={`/api/quotations/${dealId}/pdf?plate=${encodeURIComponent(v.licensePlate)}`} target="_blank" rel="noreferrer"
                className="h-8 px-2.5 inline-flex items-center gap-1 text-[12px] font-semibold border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900">
                <FileText className="w-3.5 h-3.5 text-[#7A5C14] dark:text-[#E7C86E]" /> PDF
              </a>
              <button disabled={disabled} title="ลูกค้าเลือกคันนี้ → ขึ้นเป็นคันหลักของดีล"
                onClick={async () => {
                  if (await confirm({ title: `ตั้ง ${v.licensePlate} เป็นคันหลัก?`, description: "คันหลักเดิมจะย้ายลงมาอยู่ในรายการเสนอ ไม่หายไปไหน ใบเสนอ PDF หลักจะเปลี่ยนเป็นคันนี้" })) act("primary", v.licensePlate)
                }}
                className="h-8 px-2.5 inline-flex items-center gap-1 text-[12px] font-semibold border border-[#D4A72C] text-[#7A4E00] dark:text-amber-300 rounded-lg bg-white dark:bg-zinc-900 disabled:opacity-50">
                <Star className="w-3.5 h-3.5" /> ตั้งเป็นคันหลัก
              </button>
              <button disabled={disabled} aria-label={`ถอด ${v.licensePlate}`}
                onClick={async () => { if (await confirm(`ถอด ${v.licensePlate} ออกจากดีล?`)) act("remove", v.licensePlate) }}
                className="h-8 w-8 inline-flex items-center justify-center text-zinc-400 hover:text-[#A40E26] disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
