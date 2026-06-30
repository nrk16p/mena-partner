"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Driver } from "@/types"

const DRIVER_STATUS_TABS = [
  { key: "",         label: "ทั้งหมด" },
  { key: "active",   label: "ใช้งาน" },
  { key: "inactive", label: "ไม่ใช้งาน" },
]

export default function DriversPage() {
  const [items, setItems]     = useState<Driver[]>([])
  const [q, setQ]             = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [plantFilter, setPlantFilter]   = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (statusFilter) params.set("status", statusFilter)
        const res = await fetch(`/api/drivers?${params.toString()}`)
        if (res.ok) setItems(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, statusFilter])

  const plants = Array.from(new Set(items.map((d) => d.plant).filter(Boolean))).sort()
  const visible = items.filter((d) => !plantFilter || d.plant === plantFilter)

  function handleExportCSV() {
    if (visible.length === 0) return
    const headers = ["รหัส","ชื่อผู้ขับขี่","ทะเบียน","เบอร์รถ","แพล้นท์","เบอร์โทร","สถานะ"]
    const rows = visible.map((d) => [
      d.contractCode, d.driverName, d.licensePlate, d.truckNumber, d.plant, d.phone, d.status,
    ].map((v) => (typeof v === "string" && v.includes(",")) ? `"${v}"` : v).join(","))
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `drivers-${statusFilter || "all"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">พนักงานขับรถ</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{items.length} คน</p>
        </div>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        )}
      </div>

      {plants.length > 1 && (
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          <button
            onClick={() => setPlantFilter("")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              !plantFilter
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            ทั้งหมด ({items.length})
          </button>
          {plants.map((p) => (
            <button
              key={p}
              onClick={() => setPlantFilter(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                plantFilter === p
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {p} ({items.filter((d) => d.plant === p).length})
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {DRIVER_STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-zinc-400" />
          <Input
            placeholder="ค้นหา รหัส / ชื่อ / ทะเบียน / แพล้นท์"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
        </div>
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
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : visible.map((d) => (
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
