"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Users, ClipboardList, Truck, BarChart3, ShieldCheck, TrendingUp, TrendingDown, AlertTriangle, AlertCircle } from "lucide-react"
import { formatMoney, formatMonth } from "@/lib/utils"

type Alert = {
  type: string
  severity: "critical" | "warning" | "info"
  contractCode: string
  driverName: string
  message: string
  value?: string
}

type Summary = {
  totalDrivers: number
  driversWithEntry: number
  grandNetPay: number
  grandIncome: number
  grandDeductions: number
}

type TopRow = { contractCode: string; driverName: string; plant: string; tripCount: number; netPay: number }
type TrendPoint = { month: string; totalNetPay: number; totalIncome: number; totalDeductions: number; count: number }
type PlantStat = { plant: string; totalDrivers: number; driversWithEntry: number; grandNetPay: number; grandIncome: number }

const QUICK = [
  { href: "/contracts",  label: "สัญญาเช่าซื้อ", icon: FileText },
  { href: "/drivers",    label: "พนักงานขับรถ",  icon: Users },
  { href: "/payroll",    label: "เงินเดือน",      icon: ClipboardList },
  { href: "/trips",      label: "รายเที่ยว",      icon: Truck },
  { href: "/reports",    label: "รายงาน",         icon: BarChart3 },
  { href: "/promotions", label: "โปรโมชั่น",      icon: ShieldCheck },
]

export default function DashboardPage() {
  const [month, setMonth]                   = useState<string | null>(null)
  const [months, setMonths]                 = useState<string[]>([])
  const [summary, setSummary]               = useState<Summary | null>(null)
  const [topRows, setTopRows]               = useState<TopRow[]>([])
  const [alerts, setAlerts]                 = useState<Alert[]>([])
  const [trend, setTrend]                   = useState<TrendPoint[]>([])
  const [plantBreakdown, setPlantBreakdown] = useState<PlantStat[]>([])
  const [driverCount, setDriverCount]       = useState(0)
  const [totalTrips, setTotalTrips]         = useState(0)
  const [loading, setLoading]               = useState(true)

  useEffect(() => {
    fetch("/api/payroll/months").then((r) => r.ok ? r.json() : []).then((ms: string[]) => {
      setMonths(ms)
      if (ms.length > 0) setMonth(ms[0])
    }).catch(() => {})
    fetch("/api/drivers?status=active").then((r) => r.ok ? r.json() : []).then((d: unknown[]) => setDriverCount(Array.isArray(d) ? d.length : 0)).catch(() => {})
    fetch("/api/alerts").then((r) => r.ok ? r.json() : []).then((a: Alert[]) => setAlerts(Array.isArray(a) ? a : [])).catch(() => {})
    fetch("/api/reports/trend").then((r) => r.ok ? r.json() : []).then((t: TrendPoint[]) => setTrend(Array.isArray(t) ? t : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/reports/netpay?month=${month}`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!d) return
      setSummary(d.summary)
      setTotalTrips(d.rows.reduce((s: number, r: TopRow) => s + (r.tripCount ?? 0), 0))
      setTopRows([...(d.rows as TopRow[])].sort((a, b) => b.netPay - a.netPay).slice(0, 8))
      if (Array.isArray(d.plantBreakdown)) setPlantBreakdown(d.plantBreakdown)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [month])

  const prevTrend = month && trend.length > 1 ? trend.slice(0, -1).findLast((t) => t.month < month) : null
  function mom(cur: number, prev?: number) {
    if (!prev) return null
    const pct = ((cur - prev) / Math.abs(prev)) * 100
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
  }

  const critical = alerts.filter((a) => a.severity === "critical")
  const warnings = alerts.filter((a) => a.severity === "warning")

  return (
    <div className="space-y-7 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">Dashboard</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-none">
            {month ? formatMonth(month) : "กำลังโหลด..."}
          </h1>
        </div>
        {months.length > 0 && (
          <div className="flex gap-1.5">
            {months.slice(0, 4).map((m) => (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  month === m
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {formatMonth(m).split(" ")[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "รถร่วมทั้งหมด", value: `${driverCount}`, unit: "คัน", icon: Truck, accent: "text-zinc-800 dark:text-zinc-100", mom: null },
          { label: "รวมรายรับ", value: summary ? formatMoney(summary.grandIncome) : "—", unit: "฿", icon: TrendingUp, accent: "text-emerald-600 dark:text-emerald-400", mom: summary ? mom(summary.grandIncome, prevTrend?.totalIncome) : null },
          { label: "รับสุทธิรวม", value: summary ? formatMoney(summary.grandNetPay) : "—", unit: "฿", icon: BarChart3, accent: "text-blue-600 dark:text-blue-400", mom: summary ? mom(summary.grandNetPay, prevTrend?.totalNetPay) : null },
          { label: "รวมรายหัก", value: summary ? formatMoney(summary.grandDeductions) : "—", unit: "฿", icon: TrendingDown, accent: "text-red-500 dark:text-red-400", mom: summary ? mom(summary.grandDeductions, prevTrend?.totalDeductions) : null },
        ].map(({ label, value, unit, icon: Icon, accent, mom: m }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
              <Icon className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600" />
            </div>
            <p className={`text-2xl font-bold tabular-nums tracking-tight leading-none ${accent}`}>
              {unit === "฿" && <span className="text-base font-normal mr-0.5 opacity-60">฿</span>}{value}
            </p>
            {m && (
              <p className={`text-[11px] mt-2 font-medium ${m.startsWith("+") ? "text-emerald-500" : "text-red-400"}`}>
                {m} vs เดือนก่อน
              </p>
            )}
            {!m && !loading && (
              <p className="text-[11px] mt-2 text-zinc-400">
                {label === "รถร่วมทั้งหมด" && totalTrips > 0 ? `${totalTrips.toLocaleString()} เที่ยว` : " "}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: alerts + trend + top10 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Alerts */}
          {alerts.length > 0 && (
            <div>
              <SectionLabel label={`แจ้งเตือน`} badge={`${critical.length} critical · ${warnings.length} warning`} badgeColor={critical.length > 0 ? "text-red-500" : "text-amber-500"} />
              <div className="space-y-1.5">
                {alerts.slice(0, 6).map((a, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-l-2 text-sm ${
                    a.severity === "critical"
                      ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                      : "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  }`}>
                    <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${a.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                    <span className="font-mono text-[11px] text-zinc-500 shrink-0">{a.contractCode}</span>
                    <span className="text-zinc-700 dark:text-zinc-300 text-xs truncate flex-1">{a.driverName} · {a.message}</span>
                    {a.value && <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 shrink-0 tabular-nums">{a.value}</span>}
                    <Link href={`/contracts?q=${a.contractCode}`} className="text-[11px] text-emerald-600 hover:underline shrink-0 font-medium">ดู →</Link>
                  </div>
                ))}
                {alerts.length > 6 && <p className="text-xs text-zinc-400 pl-4">+{alerts.length - 6} รายการ</p>}
              </div>
            </div>
          )}

          {/* Trend chart */}
          {trend.length > 1 && (
            <div>
              <SectionLabel label="แนวโน้ม Net Pay รายเดือน" />
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                {(() => {
                  const maxNet = Math.max(...trend.map((t) => Math.abs(t.totalNetPay)))
                  const slice = trend.slice(-12)
                  return (
                    <div className="flex items-end gap-2" style={{ height: 88 }}>
                      {slice.map((t) => {
                        const h = maxNet > 0 ? Math.max(4, (Math.abs(t.totalNetPay) / maxNet) * 72) : 4
                        const isSelected = t.month === month
                        return (
                          <button key={t.month} onClick={() => setMonth(t.month)} title={`${formatMonth(t.month)}: ฿${formatMoney(t.totalNetPay)}`} className="flex flex-col items-center gap-1.5 flex-1 group">
                            <div className="w-full flex items-end" style={{ height: 72 }}>
                              <div
                                className={`w-full rounded-t-sm transition-all duration-150 ${isSelected ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700 group-hover:bg-emerald-300 dark:group-hover:bg-emerald-700"}`}
                                style={{ height: h }}
                              />
                            </div>
                            <span className={`text-[9px] font-medium ${isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                              {formatMonth(t.month).split(" ")[0]}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Top drivers */}
          {topRows.length > 0 && (
            <div>
              <SectionLabel label={`Top ${topRows.length} — รับสุทธิ ${month ? formatMonth(month) : ""}`} />
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider w-8">#</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">รหัส / ชื่อ</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider hidden sm:table-cell">แพลนท์</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">เที่ยว</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">รับสุทธิ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                    {topRows.map((r, i) => (
                      <tr key={r.contractCode} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-zinc-300 dark:text-zinc-600 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/payroll/${month}/${r.contractCode}`} className="group flex items-center gap-2">
                            <span className="font-mono text-[11px] text-zinc-400 group-hover:text-emerald-600 transition-colors">{r.contractCode}</span>
                            <span className="text-sm text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-zinc-50 transition-colors">{r.driverName}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400 hidden sm:table-cell">{r.plant}</td>
                        <td className="px-4 py-2.5 text-right text-xs tabular-nums text-zinc-500">{r.tripCount}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-sm tabular-nums text-zinc-800 dark:text-zinc-100">
                          ฿{formatMoney(r.netPay)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right: quick nav + stats */}
        <div className="space-y-6">
          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "บันทึกแล้ว", value: summary ? `${summary.driversWithEntry}/${summary.totalDrivers}` : "—" },
              { label: "เฉลี่ยสุทธิ/คน", value: summary && summary.driversWithEntry > 0 ? `฿${formatMoney(summary.grandNetPay / summary.driversWithEntry)}` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">{label}</p>
                <p className="text-lg font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{value}</p>
              </div>
            ))}
          </div>

          {/* Quick nav */}
          <div>
            <SectionLabel label="เมนูหลัก" />
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="group flex items-center gap-2.5 px-3 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all">
                  <Icon className="w-4 h-4 text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors shrink-0" />
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Plant breakdown */}
          {plantBreakdown.length > 0 && (
            <div>
              <SectionLabel label="แยกตามแพลนท์" />
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {plantBreakdown.map((p, i) => (
                  <div key={p.plant} className={`px-4 py-3 ${i < plantBreakdown.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{p.plant}</span>
                      <span className="text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-100">฿{formatMoney(p.grandNetPay)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${p.totalDrivers > 0 ? (p.driversWithEntry / p.totalDrivers) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">{p.driversWithEntry}/{p.totalDrivers}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alert summary if no detail shown */}
          {alerts.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
              <AlertTriangle className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">ไม่มีการแจ้งเตือน</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ label, badge, badgeColor }: { label: string; badge?: string; badgeColor?: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
      {badge && <p className={`text-[10px] font-medium ${badgeColor ?? "text-zinc-400"}`}>{badge}</p>}
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )
}
