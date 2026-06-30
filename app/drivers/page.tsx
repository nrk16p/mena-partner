"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Driver } from "@/types"

export default function DriversPage() {
  const [items, setItems]     = useState<Driver[]>([])
  const [q, setQ]             = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/drivers?q=${encodeURIComponent(q)}`)
        if (res.ok) setItems(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const activeCount = items.filter((d) => d.status === "active").length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">พนักงานขับรถ</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{items.length} คน · ใช้งาน {activeCount} คน</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ชื่อ / ทะเบียน / แพล้นท์"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-left">เบอร์รถ</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-left">เบอร์โทร</th>
              <th className="px-4 py-3 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((d) => (
              <tr key={d._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <Link href={`/drivers/${d._id}`} className="text-emerald-600 hover:underline font-medium">
                    {d.contractCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{d.driverName}</td>
                <td className="px-4 py-3 font-mono text-xs">{d.licensePlate}</td>
                <td className="px-4 py-3 text-zinc-500">{d.truckNumber}</td>
                <td className="px-4 py-3 text-zinc-500">{d.plant}</td>
                <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{d.phone}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    d.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {d.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
