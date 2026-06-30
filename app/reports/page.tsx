"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatMoney, formatMonth } from "@/lib/utils"

type Row = {
  contractCode: string
  driverName: string
  truckNumber: string
  plant: string
  tripCount: number
  totalTripFee: number
  workingDays: number
  totalIncome: number
  totalDeductions: number
  netPay: number
  hasEntry: boolean
}

type Summary = {
  totalDrivers: number
  driversWithEntry: number
  grandNetPay: number
  grandIncome: number
  grandDeductions: number
}

type Report = { month: string; summary: Summary; rows: Row[] }

export default function ReportsPage() {
  const [months, setMonths]   = useState<string[]>([])
  const [month, setMonth]     = useState<string | null>(null)
  const [data, setData]       = useState<Report | null>(null)
  const [q, setQ]             = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/payroll/months")
      .then((r) => r.ok ? r.json() : [])
      .then((ms: string[]) => { setMonths(ms); if (ms.length > 0) setMonth(ms[0]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/reports/netpay?month=${month}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [month])

  const filtered = data
    ? data.rows.filter((r) =>
        [r.contractCode, r.driverName, r.truckNumber, r.plant]
          .some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))
      )
    : []

  function exportCsv() {
    if (!data) return
    const header = ["รหัส","ชื่อคนขับ","เบอร์รถ","แพล้นท์","เที่ยว","วันทำงาน","รายรับ","รายหัก","รับสุทธิ"]
    const rows = filtered.map((r) => [
      r.contractCode, r.driverName, r.truckNumber, r.plant,
      r.tripCount, r.workingDays, r.totalIncome, r.totalDeductions, r.netPay,
    ])
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payroll-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">รายงานสรุปเงินเดือน</h1>
          {data && <p className="text-sm text-zinc-400 mt-0.5">{formatMonth(data.month)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={!data}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            ดาวน์โหลด CSV
          </button>
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
          >
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "รวมรายรับ", value: formatMoney(data.summary.grandIncome),     color: "text-emerald-600" },
            { label: "รวมรายหัก", value: formatMoney(data.summary.grandDeductions), color: "text-red-500" },
            { label: "รวมสุทธิ",  value: formatMoney(data.summary.grandNetPay),     color: "text-zinc-800 dark:text-zinc-100" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ชื่อ / เบอร์รถ / แพล้นท์"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {q && data && (
          <span className="text-xs text-zinc-400">พบ {filtered.length} รายการ</span>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อคนขับ</th>
              <th className="px-4 py-3 text-left">เบอร์รถ</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-right">เที่ยว</th>
              <th className="px-4 py-3 text-right">วัน</th>
              <th className="px-4 py-3 text-right">รายรับรวม</th>
              <th className="px-4 py-3 text-right">รายหักรวม</th>
              <th className="px-4 py-3 text-right">รับสุทธิ</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.contractCode} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/payroll/${month}/${r.contractCode}`} className="text-emerald-600 hover:underline">
                      {r.contractCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.driverName}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.truckNumber}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.plant}</td>
                  <td className="px-4 py-3 text-right">{r.tripCount}</td>
                  <td className="px-4 py-3 text-right">{r.workingDays}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(r.totalIncome)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatMoney(r.totalDeductions)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${r.netPay < 0 ? "text-red-600" : ""}`}>
                    {formatMoney(r.netPay)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.hasEntry ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {r.hasEntry ? "บันทึกแล้ว" : "รอบันทึก"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
