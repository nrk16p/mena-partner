"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Printer, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMoney, formatMonth } from "@/lib/utils"
import type { PayrollEntry, Driver } from "@/types"

type MonthPhase = "draft" | "review" | "approved" | "locked"

interface RowData {
  entry: PayrollEntry
  driver?: Driver
}

const PHASE_LABEL: Record<MonthPhase, string> = {
  draft:    "ร่าง",
  review:   "กำลังตรวจสอบ",
  approved: "อนุมัติแล้ว",
  locked:   "ล็อคแล้ว",
}
const PHASE_COLOR: Record<MonthPhase, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  review:   "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  locked:   "bg-emerald-100 text-emerald-700",
}

export default function PayrollMonthPage() {
  const { month } = useParams<{ month: string }>()

  const [entries, setEntries]   = useState<PayrollEntry[]>([])
  const [drivers, setDrivers]   = useState<Driver[]>([])
  const [phase, setPhase]       = useState<MonthPhase>("draft")
  const [loading, setLoading]   = useState(true)
  const [plantFilter, setPlantFilter] = useState("")

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/payroll?month=${month}`).then((r) => r.ok ? r.json() : []),
      fetch("/api/drivers").then((r) => r.ok ? r.json() : []),
      fetch(`/api/month-status?month=${month}`).then((r) => r.ok ? r.json() : { phase: "draft" }),
    ]).then(([e, d, s]) => {
      setEntries(Array.isArray(e) ? e : [])
      setDrivers(Array.isArray(d) ? d : [])
      setPhase((s as { phase: MonthPhase }).phase ?? "draft")
    }).finally(() => setLoading(false))
  }, [month])

  const driverMap = Object.fromEntries(drivers.map((d) => [d.contractCode, d]))

  const plants = Array.from(new Set(drivers.map((d) => d.plant).filter(Boolean))).sort()

  const rows: RowData[] = entries
    .filter((e) => !plantFilter || (driverMap[e.contractCode]?.plant ?? "") === plantFilter)
    .map((e) => ({ entry: e, driver: driverMap[e.contractCode] }))

  const totalIncome     = rows.reduce((s, r) => s + r.entry.totalIncome, 0)
  const totalDeductions = rows.reduce((s, r) => s + r.entry.totalDeductions, 0)
  const totalNetPay     = rows.reduce((s, r) => s + r.entry.netPay, 0)

  if (loading) return <div className="text-zinc-400 text-sm p-8">กำลังโหลด...</div>

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-5 print:max-w-none print:p-4">
      {/* Header — hidden on print */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/payroll">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">เงินเดือน {formatMonth(month)}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${PHASE_COLOR[phase]}`}>
              {PHASE_LABEL[phase]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
          >
            <option value="">ทุกแพลนท์</option>
            {plants.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Button
            onClick={() => window.print()}
            className="bg-zinc-800 hover:bg-zinc-900 text-white flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            พิมพ์
          </Button>
        </div>
      </div>

      {/* Print title */}
      <div className="hidden print:block text-center pb-3 border-b">
        <h1 className="text-xl font-bold">สรุปเงินเดือนรถร่วม Mixer — {formatMonth(month)}</h1>
        {plantFilter && <p className="text-sm text-gray-500">แพลนท์: {plantFilter}</p>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 print:gap-2">
        {[
          { label: "รายได้รวม", value: totalIncome, color: "text-emerald-600" },
          { label: "หักรวม",    value: totalDeductions, color: "text-red-600" },
          { label: "สุทธิรวม",  value: totalNetPay, color: totalNetPay >= 0 ? "text-blue-600" : "text-red-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 print:border-gray-300 print:rounded">
            <p className="text-xs text-zinc-500 print:text-gray-500">{label}</p>
            <p className={`text-lg font-bold ${color}`}>฿{formatMoney(value)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto print:border-gray-300 print:rounded">
        <table className="w-full text-sm print:text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 print:bg-gray-100">
              <th className="px-3 py-2 text-left text-zinc-500 print:text-gray-600 font-medium w-24">รหัส</th>
              <th className="px-3 py-2 text-left text-zinc-500 print:text-gray-600 font-medium">ชื่อ</th>
              <th className="px-3 py-2 text-right text-zinc-500 print:text-gray-600 font-medium">วันทำงาน</th>
              <th className="px-3 py-2 text-right text-zinc-500 print:text-gray-600 font-medium">เที่ยว</th>
              <th className="px-3 py-2 text-right text-zinc-500 print:text-gray-600 font-medium">ค่าขนส่ง</th>
              <th className="px-3 py-2 text-right text-zinc-500 print:text-gray-600 font-medium">รายได้รวม</th>
              <th className="px-3 py-2 text-right text-zinc-500 print:text-gray-600 font-medium">หักรวม</th>
              <th className="px-3 py-2 text-right text-zinc-500 print:text-gray-600 font-medium font-semibold">สุทธิ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, driver }) => (
              <tr
                key={entry.contractCode}
                className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 print:border-gray-200 ${
                  entry.netPay < 0 ? "bg-red-50/40 dark:bg-red-950/20 print:bg-red-50" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs text-zinc-500 print:text-gray-500">{entry.contractCode}</td>
                <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200 print:text-gray-800">
                  {driver?.driverName ?? entry.contractCode}
                </td>
                <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{entry.workingDays}</td>
                <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{entry.tripCount}</td>
                <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatMoney(entry.transportFee)}</td>
                <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400 font-medium">{formatMoney(entry.totalIncome)}</td>
                <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{formatMoney(entry.totalDeductions)}</td>
                <td className={`px-3 py-2 text-right font-bold ${entry.netPay < 0 ? "text-red-700" : "text-zinc-900 dark:text-zinc-100"}`}>
                  {formatMoney(entry.netPay)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 print:border-gray-400 bg-zinc-50 dark:bg-zinc-800/50 print:bg-gray-100 font-bold">
              <td colSpan={5} className="px-3 py-2 text-zinc-600 print:text-gray-600">รวม {rows.length} คน</td>
              <td className="px-3 py-2 text-right text-emerald-700">{formatMoney(totalIncome)}</td>
              <td className="px-3 py-2 text-right text-red-600">{formatMoney(totalDeductions)}</td>
              <td className={`px-3 py-2 text-right ${totalNetPay >= 0 ? "text-zinc-900 dark:text-zinc-100" : "text-red-700"}`}>
                {formatMoney(totalNetPay)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Per-driver payslip links — hidden on print */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {rows.map(({ entry, driver }) => (
          <Link
            key={entry.contractCode}
            href={`/payroll/${month}/${entry.contractCode}`}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 hover:border-emerald-400 hover:shadow-sm transition-all"
          >
            <p className="text-xs text-zinc-400 font-mono">{entry.contractCode}</p>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{driver?.driverName ?? entry.contractCode}</p>
            <p className={`text-sm font-bold mt-1 ${entry.netPay < 0 ? "text-red-600" : "text-emerald-600"}`}>
              ฿{formatMoney(entry.netPay)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
