"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { PlusCircle, Search, Upload, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatMonth } from "@/lib/utils"
import type { Trip } from "@/types"

function buildMonthOptions() {
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
  const options             = buildMonthOptions()
  const [month, setMonth]   = useState(options[0].value)
  const [q, setQ]           = useState("")
  const [plant, setPlant]   = useState("")
  const [items, setItems]   = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)

  // Default to latest month with data
  useEffect(() => {
    fetch("/api/payroll/months")
      .then((r) => r.ok ? r.json() : [])
      .then((ms: string[]) => { if (ms.length > 0) setMonth(ms[0]) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({ month })
    if (q) params.set("contractCode", q)
    if (plant) params.set("plant", plant)
    const load = async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/trips?${params.toString()}`)
        if (r.ok) {
          const d = await r.json()
          setItems(d)
        } else {
          setItems([])
        }
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month, q, plant])

  async function handleDelete(id: string) {
    if (!confirm("ลบเที่ยวนี้?")) return
    try {
      const r = await fetch(`/api/trips/${id}`, { method: "DELETE" })
      if (r.ok) {
        setItems((p) => p.filter((t) => t._id !== id))
      } else {
        alert("ลบไม่สำเร็จ กรุณาลองใหม่")
      }
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }

  async function handleBulkDelete() {
    const label = q ? `${items.length} เที่ยวของ ${q} เดือน ${month}` : `${items.length} เที่ยวเดือน ${month}`
    if (!confirm(`ลบ${label}ทั้งหมด? การกระทำนี้ไม่สามารถยกเลิกได้`)) return
    try {
      const params = new URLSearchParams({ month })
      if (q) params.set("contractCode", q)
      const r = await fetch(`/api/trips?${params.toString()}`, { method: "DELETE" })
      if (r.ok) {
        const d = await r.json()
        setItems([])
        alert(`ลบแล้ว ${d.deleted} รายการ`)
      } else {
        alert("ลบไม่สำเร็จ กรุณาลองใหม่")
      }
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">รายเที่ยว</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {items.length} รายการ{items.length >= 500 ? " (จำกัด 500 แรก — กรอง contractCode เพื่อดูทั้งหมด)" : ""}
            {items.length > 0 && (
              <> · ค่าเที่ยวรวม <span className="text-zinc-600 font-medium">
                {formatMoney(items.reduce((s, t) => s + (t.tripFee ?? 0), 0))}
              </span></>
            )}
          </p>
        </div>
        {session?.user?.role === "admin" && (
          <div className="flex gap-2">
            {items.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-2"
                title={`ลบ ${items.length} รายการที่แสดงอยู่`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                ลบทั้งหมด ({items.length})
              </button>
            )}
            <Link
              href="/trips/import"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2"
            >
              <Upload className="w-3.5 h-3.5" />
              นำเข้า CSV
            </Link>
            <Link href="/trips/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlusCircle className="w-4 h-4 mr-2" /> เพิ่มรายเที่ยว
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Plant summary */}
      {!q && !plant && items.length > 0 && (() => {
        const plantMap: Record<string, { count: number; total: number }> = {}
        for (const t of items) {
          const p = t.plant || "ไม่ระบุ"
          if (!plantMap[p]) plantMap[p] = { count: 0, total: 0 }
          plantMap[p].count += 1
          plantMap[p].total += t.tripFee ?? 0
        }
        const plants = Object.entries(plantMap).sort((a, b) => b[1].total - a[1].total)
        if (plants.length < 2) return null
        return (
          <div className="mb-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">แพล้นท์</span>
            </div>
            <div className="flex flex-wrap">
              {plants.map(([p, stats]) => (
                <button
                  key={p}
                  onClick={() => setPlant(p)}
                  className="px-4 py-2.5 text-left border-r border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{p}</div>
                  <div className="text-xs text-zinc-400">{stats.count} เที่ยว · {formatMoney(stats.total)}</div>
                </button>
              ))}
            </div>
          </div>
        )
      })()}

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
        <Input
          placeholder="แพล้นท์"
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
          className="max-w-36"
        />
        {plant && (
          <button onClick={() => setPlant("")} className="text-xs text-zinc-400 hover:text-zinc-600">
            ✕ ล้าง
          </button>
        )}
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
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/trips/${t._id}`} className="text-xs text-zinc-500 hover:underline">แก้ไข</Link>
                      <button onClick={() => handleDelete(t._id!)} className="text-xs text-red-500 hover:underline">ลบ</button>
                    </div>
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
