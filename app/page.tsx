"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Users, ClipboardList, Truck, BarChart3, ShieldCheck, TrendingUp, TrendingDown } from "lucide-react"
import { formatMoney, formatMonth } from "@/lib/utils"

type Summary = {
  totalDrivers: number
  driversWithEntry: number
  grandNetPay: number
  grandIncome: number
  grandDeductions: number
}

type TopRow = {
  contractCode: string
  driverName: string
  plant: string
  tripCount: number
  netPay: number
}

const QUICK = [
  { href: "/contracts",  label: "สัญญาเช่าซื้อ", icon: FileText,    color: "bg-blue-50 text-blue-600" },
  { href: "/drivers",    label: "พนักงานขับรถ",  icon: Users,        color: "bg-emerald-50 text-emerald-600" },
  { href: "/payroll",    label: "เงินเดือน",      icon: ClipboardList,color: "bg-amber-50 text-amber-600" },
  { href: "/trips",      label: "รายเที่ยว",      icon: Truck,        color: "bg-purple-50 text-purple-600" },
  { href: "/reports",    label: "รายงาน",         icon: BarChart3,    color: "bg-red-50 text-red-600" },
  { href: "/promotions", label: "โปรโมชั่น",      icon: ShieldCheck,  color: "bg-teal-50 text-teal-600" },
]

export default function DashboardPage() {
  const [month, setMonth]             = useState<string | null>(null)
  const [months, setMonths]           = useState<string[]>([])
  const [summary, setSummary]         = useState<Summary | null>(null)
  const [topRows, setTopRows]         = useState<TopRow[]>([])
  const [driverCount, setDriverCount] = useState(0)
  const [totalTrips, setTotalTrips]   = useState(0)
  const [loading, setLoading]         = useState(true)

  // 1. Fetch available months and pick the latest
  useEffect(() => {
    fetch("/api/payroll/months")
      .then((r) => r.ok ? r.json() : [])
      .then((ms: string[]) => {
        setMonths(ms)
        if (ms.length > 0) setMonth(ms[0])
      })
      .catch(() => {})
    fetch("/api/drivers?status=active")
      .then((r) => r.ok ? r.json() : [])
      .then((d: unknown[]) => setDriverCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {})
  }, [])

  // 2. Load report data when month is known
  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/reports/netpay?month=${month}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return
        setSummary(d.summary)
        setTotalTrips(d.rows.reduce((s: number, r: TopRow) => s + (r.tripCount ?? 0), 0))
        const sorted = [...(d.rows as TopRow[])].sort((a, b) => b.netPay - a.netPay)
        setTopRows(sorted.slice(0, 10))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month])

  const avgNetPay = summary && summary.driversWithEntry > 0
    ? summary.grandNetPay / summary.driversWithEntry
    : null

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">หน้าหลัก</h1>
          <p className="text-sm text-zinc-400 mt-1">{month ? formatMonth(month) : "กำลังโหลด..."}</p>
        </div>
        {months.length > 0 && (
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
          >
            {months.map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "รถร่วมทั้งหมด",   value: `${driverCount} คัน`,                                       color: "", icon: Truck },
          { label: "รวมรายรับ",        value: summary ? formatMoney(summary.grandIncome) : "-",            color: "text-emerald-600", icon: TrendingUp },
          { label: "รวมรายหัก",        value: summary ? formatMoney(summary.grandDeductions) : "-",        color: "text-red-500", icon: TrendingDown },
          { label: "รับสุทธิรวม",      value: summary ? formatMoney(summary.grandNetPay) : "-",            color: "text-zinc-800 dark:text-zinc-100", icon: BarChart3 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "จำนวนเที่ยวรวม",       value: loading ? "-" : totalTrips.toLocaleString() + " เที่ยว" },
          { label: "บันทึกเงินเดือนแล้ว",   value: summary ? `${summary.driversWithEntry} / ${summary.totalDrivers}` : "-" },
          { label: "เฉลี่ยสุทธิต่อคน",       value: avgNetPay ? formatMoney(avgNetPay) : "-" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick nav */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 mb-3 uppercase tracking-wide">เมนูหลัก</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {QUICK.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 hover:shadow-sm transition-all text-center"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Top 10 by net pay */}
      {topRows.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 mb-3 uppercase tracking-wide">Top 10 รับสุทธิ</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">รหัส</th>
                  <th className="px-4 py-3 text-left">ชื่อคนขับ</th>
                  <th className="px-4 py-3 text-left">แพล้นท์</th>
                  <th className="px-4 py-3 text-right">เที่ยว</th>
                  <th className="px-4 py-3 text-right">รับสุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {topRows.map((r, i) => (
                  <tr key={r.contractCode} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-zinc-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/payroll/${month}/${r.contractCode}`} className="text-emerald-600 hover:underline">
                        {r.contractCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.driverName}</td>
                    <td className="px-4 py-3 text-zinc-500">{r.plant}</td>
                    <td className="px-4 py-3 text-right">{r.tripCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(r.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
