"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { Driver, PayrollEntry } from "@/types"
import { formatMoney, formatMonth } from "@/lib/utils"

type DriverWithHistory = Driver & { payrollHistory: PayrollEntry[] }

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DriverWithHistory | null>(null)

  useEffect(() => {
    fetch(`/api/drivers/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d) })
  }, [id])

  if (!data) return <div className="text-zinc-400 text-sm">กำลังโหลด...</div>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{data.driverName}</h1>
        <p className="text-sm text-zinc-400">{data.contractCode} · {data.licensePlate} · {data.plant}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          ["ชื่อผู้เช่าซื้อ", data.buyerName],
          ["เบอร์โทร", data.phone],
          ["เบอร์รถ", data.truckNumber],
          ["แพล้นท์", data.plant],
        ].map(([label, value]) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-3">ประวัติเงินเดือน (6 เดือนล่าสุด)</h2>
        {data.payrollHistory.length === 0 ? (
          <p className="text-sm text-zinc-400">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">เดือน</th>
                  <th className="px-4 py-3 text-right">รายรับ</th>
                  <th className="px-4 py-3 text-right">รายหัก</th>
                  <th className="px-4 py-3 text-right">สุทธิ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.payrollHistory.map((p) => (
                  <tr key={p._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">{formatMonth(p.month)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(p.totalIncome)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{formatMoney(p.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.netPay)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/payroll/${p.month}/${data.contractCode}`} className="text-xs text-emerald-600 hover:underline">
                        ดู →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
