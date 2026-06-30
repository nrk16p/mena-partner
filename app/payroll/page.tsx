"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { formatMonth, formatMoney } from "@/lib/utils"
import type { Driver, PayrollEntry } from "@/types"

function monthOptions() {
  const now  = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    opts.push({ value: v, label: formatMonth(v) })
  }
  return opts
}

export default function PayrollPage() {
  const options             = monthOptions()
  const [month, setMonth]   = useState(options[0].value)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/drivers?status=active").then((r) => r.json()).then(setDrivers)
  }, [])

  useEffect(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/payroll?month=${month}`)
      .then((r) => r.json())
      .then((d) => { setEntries(d); setLoading(false) })
  }, [month])

  const entryMap = Object.fromEntries(entries.map((e) => [e.contractCode, e]))

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">เงินเดือน</h1>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="ml-auto rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
            ) : drivers.map((d) => {
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
                  <td className="px-4 py-3 text-right font-semibold">
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
                    <Link
                      href={`/payroll/${month}/${d.contractCode}`}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      {entry ? "แก้ไข →" : "กรอก →"}
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
