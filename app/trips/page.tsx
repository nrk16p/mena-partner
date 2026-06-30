"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { PlusCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatMonth } from "@/lib/utils"
import type { Trip } from "@/types"

function monthOptions() {
  const now = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    opts.push({ value: v, label: formatMonth(v) })
  }
  return opts
}

export default function TripsPage() {
  const { data: session }   = useSession()
  const options             = monthOptions()
  const [month, setMonth]   = useState(options[0].value)
  const [q, setQ]           = useState("")
  const [items, setItems]   = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (q) params.set("contractCode", q)
    fetch(`/api/trips?${params}`)
      .then((r) => r.json())
      .then((d) => { setItems(d); setLoading(false) })
  }, [month, q])

  async function handleDelete(id: string) {
    if (!confirm("ลบรายเที่ยวนี้?")) return
    await fetch(`/api/trips/${id}`, { method: "DELETE" })
    setItems((p) => p.filter((t) => t._id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">รายเที่ยว</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{items.length} รายการ</p>
        </div>
        {session?.user?.role === "admin" && (
          <Link href="/trips/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="w-4 h-4 mr-2" /> เพิ่มรายเที่ยว
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-zinc-400" />
          <Input
            placeholder="รหัสสัญญา (MTL003)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-48"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">วันที่</th>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">LDT</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-left">ปลายทาง</th>
              <th className="px-4 py-3 text-left">จังหวัด</th>
              <th className="px-4 py-3 text-right">ค่าเที่ยว</th>
              {session?.user?.role === "admin" && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((t) => (
              <tr key={t._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-zinc-500 text-xs">{t.date?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-medium">{t.contractCode}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.ldtNumber}</td>
                <td className="px-4 py-3 text-zinc-500">{t.plant}</td>
                <td className="px-4 py-3">{t.destinationName}</td>
                <td className="px-4 py-3 text-zinc-500">{t.province}</td>
                <td className="px-4 py-3 text-right">{formatMoney(t.tripFee)}</td>
                {session?.user?.role === "admin" && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t._id!)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
