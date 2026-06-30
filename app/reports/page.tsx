"use client"

import { useEffect, useState } from "react"
import { formatMoney, formatMonth } from "@/lib/utils"

type Row = {
  contractCode: string
  driverName: string
  truckNumber: string
  plant: string
  tripCount: number
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

type Report = {
  month: string
  summary: Summary
  rows: Row[]
}

function monthOptions() {
  const now = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    opts.push({ value: v, label: formatMonth(v) })
  }
  return opts
}

export default function ReportsPage() {
  const options               = monthOptions()
  const [month, setMonth]     = useState(options[0].value)
  const [data, setData]       = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/reports/netpay?month=${month}`)
        if (r.ok) {
          const d = await r.json()
          setData(d)
        } else {
          setData(null)
        }
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">รายงานสรุปเงินเดือน</h1>
          {data && <p className="text-sm text-zinc-400 mt-0.5">{formatMonth(data.month)}</p>}
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "รวมรายรับ", value: formatMoney(data.summary.grandIncome),     color: "text-emerald-600" },
            { label: "รวมรายหัก", value: formatMoney(data.summary.grandDeductions), color: "text-red-500" },
            { label: "รวมสุทธิ",  value: formatMoney(data.summary.grandNetPay),     color: "text-zinc-800 dark:text-zinc-100" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4"
            >
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อคนขับ</th>
              <th className="px-4 py-3 text-left">เบอร์รถ</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-right">เที่ยว</th>
              <th className="px-4 py-3 text-right">รายรับรวม</th>
              <th className="px-4 py-3 text-right">รายหักรวม</th>
              <th className="px-4 py-3 text-right">รับสุทธิ</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                  กำลังโหลด...
                </td>
              </tr>
            ) : !data ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.contractCode} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium">{r.contractCode}</td>
                  <td className="px-4 py-3">{r.driverName}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.truckNumber}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.plant}</td>
                  <td className="px-4 py-3 text-right">{r.tripCount}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(r.totalIncome)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatMoney(r.totalDeductions)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMoney(r.netPay)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.hasEntry
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
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
