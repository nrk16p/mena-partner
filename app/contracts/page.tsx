"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { PlusCircle, Search, AlertTriangle, Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
import type { Contract } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน", completed: "สิ้นสุด", terminated: "ยกเลิก"
}
const STATUS_COLOR: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  completed:  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  terminated: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
}

const STATUS_TABS = [
  { key: "",           label: "ทั้งหมด" },
  { key: "active",     label: "ใช้งาน" },
  { key: "completed",  label: "สิ้นสุด" },
  { key: "terminated", label: "ยกเลิก" },
]

export default function ContractsPage() {
  const { data: session } = useSession()
  const [items, setItems]   = useState<Contract[]>([])
  const [q, setQ]           = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (statusFilter) params.set("status", statusFilter)
        const res = await fetch(`/api/contracts?${params}`)
        if (res.ok) setItems(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, statusFilter])

  const today = new Date().toISOString().slice(0, 10)
  const d60 = new Date(); d60.setDate(d60.getDate() + 60)
  const in60 = d60.toISOString().slice(0, 10)

  function handleExportCSV() {
    if (!items.length) return
    const headers = [
      "รหัส","ชื่อผู้เช่าซื้อ","ทะเบียน","เบอร์รถ","ยี่ห้อ","รุ่น",
      "วันที่ทำสัญญา","วันที่เริ่ม","ราคารถ","เงินดาวน์","ค่างวด/เดือน","จำนวนงวด",
      "บริษัทประกัน","วันต่อภาษี","วันหมดอายุ","สถานะ",
    ]
    const rows = items.map((c) => [
      c.contractCode, c.buyerName, c.licensePlate, c.truckNumber,
      c.vehicleBrand, c.vehicleModel ?? "",
      c.contractDate?.slice(0, 10) ?? "", c.startDate?.slice(0, 10) ?? "",
      c.totalPrice, c.downPayment, c.monthlyInstallment, c.totalInstallments,
      c.insurer ?? "", c.taxRenewalDate ?? "", c.taxExpiryDate ?? "", c.status,
    ].map((v) => (typeof v === "string" && v.includes(",")) ? `"${v}"` : v).join(","))
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `contracts-${statusFilter || "all"}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const counts = {
    active:     items.filter((c) => c.status === "active").length,
    completed:  items.filter((c) => c.status === "completed").length,
    terminated: items.filter((c) => c.status === "terminated").length,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            สัญญาเช่าซื้อ
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {items.length} สัญญา
            {statusFilter === "" && (
              <> · ใช้งาน <span className="text-emerald-600 font-medium">{counts.active}</span> / สิ้นสุด {counts.completed} / ยกเลิก {counts.terminated}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
          {session?.user?.role === "admin" && (
            <Link href="/contracts/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlusCircle className="w-4 h-4 mr-1.5" /> เพิ่มสัญญา
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <Input
            placeholder="ค้นหา รหัส / ชื่อ / ทะเบียน / เบอร์รถ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-[11px] text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">รหัสสัญญา</th>
              <th className="px-4 py-3 text-left font-semibold">ชื่อผู้เช่าซื้อ</th>
              <th className="px-4 py-3 text-left font-semibold">ทะเบียนรถ</th>
              <th className="px-4 py-3 text-left font-semibold">ยี่ห้อ / รุ่น</th>
              <th className="px-4 py-3 text-right font-semibold">ค่างวด/เดือน</th>
              <th className="px-4 py-3 text-center font-semibold">ประกัน</th>
              <th className="px-4 py-3 text-center font-semibold">สถานะ</th>
              <th className="px-4 py-3 text-center font-semibold">เอกสาร</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((c) => {
              const insExpired  = c.taxExpiryDate && c.taxExpiryDate < today
              const insExpiring = !insExpired && c.taxExpiryDate && c.taxExpiryDate <= in60
              return (
                <tr key={c._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contracts/${c._id}`}
                      className="font-mono font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline text-xs"
                    >
                      {c.contractCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-800 dark:text-zinc-200">{c.buyerName}</div>
                    {c.driverName && c.driverName !== c.buyerName && (
                      <div className="text-xs text-zinc-400 mt-0.5">{c.driverName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{c.licensePlate || "—"}</span>
                    {c.truckNumber && <div className="text-xs text-zinc-400 mt-0.5">{c.truckNumber}</div>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                    <span className="font-medium">{c.vehicleBrand || "—"}</span>
                    {c.vehicleModel && <span className="text-zinc-400"> · {c.vehicleModel}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.monthlyInstallment ? (
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatMoney(c.monthlyInstallment)}</span>
                        <span className="text-xs text-zinc-400 ml-1">×{c.totalInstallments}</span>
                      </div>
                    ) : <span className="text-zinc-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {insExpired ? (
                      <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-medium" title={`หมดอายุ ${c.taxExpiryDate}`}>
                        <AlertTriangle className="w-3 h-3" /> หมดแล้ว
                      </span>
                    ) : insExpiring ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs font-medium" title={`หมด ${c.taxExpiryDate}`}>
                        <AlertTriangle className="w-3 h-3" /> ใกล้หมด
                      </span>
                    ) : c.taxExpiryDate ? (
                      <span className="text-xs text-zinc-400">{c.taxExpiryDate.slice(0, 7)}</span>
                    ) : (
                      <span className="text-zinc-200 dark:text-zinc-700 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/contracts/${c._id}/document`}
                      title="เอกสารสัญญา (PDF)"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                    >
                      <FileText className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
