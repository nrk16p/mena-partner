"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Printer } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatMonth, formatMoney } from "@/lib/utils"
import type { Driver, PayrollEntry } from "@/types"

export default function PayrollPage() {
  const [months, setMonths]     = useState<string[]>([])
  const [month, setMonth]       = useState<string | null>(null)
  const [drivers, setDrivers]   = useState<Driver[]>([])
  const [entries, setEntries]   = useState<PayrollEntry[]>([])
  const [q, setQ]               = useState("")
  const [showPending, setShowPending] = useState(false)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    fetch("/api/payroll/months")
      .then((r) => r.ok ? r.json() : [])
      .then((ms: string[]) => { setMonths(ms); if (ms.length > 0) setMonth(ms[0]) })
      .catch(() => {})
    fetch("/api/drivers?status=active")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDrivers(Array.isArray(d) ? d : []))
      .catch(() => setDrivers([]))
  }, [])

  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/payroll?month=${month}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [month])

  const entryMap = Object.fromEntries(entries.map((e) => [e.contractCode, e]))

  const filtered = drivers.filter((d) => {
    const matchQ = !q || [d.contractCode, d.driverName, d.plant ?? ""]
      .some((v) => v.toLowerCase().includes(q.toLowerCase()))
    const matchPending = !showPending || !entryMap[d.contractCode]
    return matchQ && matchPending
  })

  const recorded = entries.length
  const totalNetPay = entries.reduce((s, e) => s + (e.netPay ?? 0), 0)

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">เงินเดือน</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            บันทึกแล้ว {recorded} / {drivers.length} คน
            {recorded > 0 && <> · สุทธิรวม <span className="text-zinc-600 font-medium">{formatMoney(totalNetPay)}</span></>}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {month && recorded > 0 && (
            <Link
              href={`/payroll/${month}/print-all`}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์ทั้งหมด
            </Link>
          )}
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
          >
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Progress bar */}
      {drivers.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>บันทึกแล้ว {recorded} / {drivers.length} คน</span>
            <span>{Math.round((recorded / drivers.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${recorded === drivers.length ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${(recorded / drivers.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ชื่อ / แพล้นท์"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPending}
            onChange={(e) => setShowPending(e.target.checked)}
            className="rounded"
          />
          แสดงเฉพาะที่ยังไม่บันทึก
        </label>
        {showPending && <span className="text-xs text-amber-600 font-medium">{filtered.length} คน</span>}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-right">รายรับ</th>
              <th className="px-4 py-3 text-right">รายหัก</th>
              <th className="px-4 py-3 text-right">สุทธิ</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : filtered.map((d) => {
              const entry = entryMap[d.contractCode]
              return (
                <tr key={d._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium">{d.contractCode}</td>
                  <td className="px-4 py-3">{d.driverName}</td>
                  <td className="px-4 py-3 text-zinc-500">{d.plant}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    {entry ? formatMoney(entry.totalIncome) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {entry ? formatMoney(entry.totalDeductions) : "-"}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${entry && entry.netPay < 0 ? "text-red-600" : ""}`}>
                    {entry ? formatMoney(entry.netPay) : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {entry ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {entry && (
                        <Link
                          href={`/payroll/${month}/${d.contractCode}/print`}
                          className="text-zinc-400 hover:text-zinc-600"
                          title="พิมพ์ใบแจ้งเงินเดือน"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link
                        href={`/payroll/${month}/${d.contractCode}`}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        {entry ? "แก้ไข →" : "กรอก →"}
                      </Link>
                    </div>
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
