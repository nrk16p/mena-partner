"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { PlusCircle, Search, AlertTriangle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
import type { Contract } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน", completed: "สิ้นสุด", terminated: "ยกเลิก"
}
const STATUS_COLOR: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  completed:  "bg-blue-100 text-blue-700",
  terminated: "bg-red-100 text-red-700",
}

const STATUS_TABS = [
  { key: "",           label: "ทั้งหมด" },
  { key: "active",     label: "ใช้งาน" },
  { key: "completed",  label: "สิ้นสุด" },
  { key: "terminated", label: "ยกเลิก" },
]

export default function ContractsPage() {
  const { data: session } = useSession()
  const [items, setItems]     = useState<Contract[]>([])
  const [q, setQ]             = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (statusFilter) params.set("status", statusFilter)
        const res = await fetch(`/api/contracts?${params.toString()}`)
        if (res.ok) setItems(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, statusFilter])

  const today = new Date().toISOString().slice(0, 10)
  const in60  = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)

  const activeCount = items.filter((c) => c.status === "active").length

  function handleExportCSV() {
    if (items.length === 0) return
    const headers = [
      "รหัส","ชื่อผู้เช่าซื้อ","ชื่อผู้ขับขี่","ทะเบียน","เบอร์รถ","แพล้นท์",
      "วันที่ทำสัญญา","วันที่เริ่ม","ราคารถ","เงินดาวน์","ค่างวด/เดือน","จำนวนงวด",
      "ผู้รับประกัน","วันต่อภาษี","วันหมดอายุ","ค่าประกัน/เดือน","สถานะ",
    ]
    const rows = items.map((c) => [
      c.contractCode, c.buyerName, c.driverName, c.licensePlate, c.truckNumber, c.plant,
      c.contractDate?.slice(0,10) ?? "", c.startDate?.slice(0,10) ?? "",
      c.totalPrice, c.downPayment, c.monthlyInstallment, c.totalInstallments,
      c.insurer ?? "", c.taxRenewalDate ?? "", c.taxExpiryDate ?? "", c.monthlyInsuranceFee ?? 0,
      c.status,
    ].map((v) => (typeof v === "string" && v.includes(",")) ? `"${v}"` : v).join(","))
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `contracts-${statusFilter || "all"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">สัญญาเช่าซื้อ</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {items.length} สัญญา{statusFilter === "active" ? ` · ใช้งาน ${activeCount} คัน` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          )}
          {session?.user?.role === "admin" && (
            <Link href="/contracts/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlusCircle className="w-4 h-4 mr-2" /> เพิ่มสัญญา
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
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
              <th className="px-4 py-3 text-left">ชื่อผู้เช่าซื้อ</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-right">ค่างวด/เดือน</th>
              <th className="px-4 py-3 text-center">ประกัน</th>
              <th className="px-4 py-3 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((c) => {
              const insExpired  = c.taxExpiryDate && c.taxExpiryDate < today
              const insExpiring = !insExpired && c.taxExpiryDate && c.taxExpiryDate <= in60
              return (
              <tr key={c._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <Link href={`/contracts/${c._id}`} className="text-emerald-600 hover:underline font-medium">
                    {c.contractCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.buyerName}</td>
                <td className="px-4 py-3 text-zinc-500">{c.driverName}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.licensePlate}</td>
                <td className="px-4 py-3 text-zinc-500">{c.plant}</td>
                <td className="px-4 py-3 text-right text-xs">
                  {c.monthlyInstallment
                    ? <><span className="font-medium">{formatMoney(c.monthlyInstallment)}</span><span className="text-zinc-400 ml-1">×{c.totalInstallments}</span></>
                    : <span className="text-zinc-300">-</span>
                  }
                </td>
                <td className="px-4 py-3 text-center">
                  {insExpired ? (
                    <span className="flex items-center justify-center gap-0.5 text-red-500 text-xs" title={`หมดอายุ ${c.taxExpiryDate}`}>
                      <AlertTriangle className="w-3 h-3" /> หมดแล้ว
                    </span>
                  ) : insExpiring ? (
                    <span className="flex items-center justify-center gap-0.5 text-amber-500 text-xs" title={`หมด ${c.taxExpiryDate}`}>
                      <AlertTriangle className="w-3 h-3" /> ใกล้หมด
                    </span>
                  ) : c.taxExpiryDate ? (
                    <span className="text-xs text-zinc-400">{c.taxExpiryDate.slice(0, 7)}</span>
                  ) : (
                    <span className="text-zinc-200 text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
              </tr>
            )})}

          </tbody>
        </table>
      </div>
    </div>
  )
}
