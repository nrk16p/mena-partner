"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { FileText, ShieldCheck, Truck } from "lucide-react"
import type { Driver, PayrollEntry } from "@/types"
import { formatMoney, formatMonth } from "@/lib/utils"

type DriverWithHistory = Driver & { payrollHistory: PayrollEntry[] }

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DriverWithHistory | null>(null)
  const [contractId, setContractId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/drivers/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setData(d)
          // Load contract ID for deep link
          fetch(`/api/contracts?q=${encodeURIComponent(d.contractCode)}`)
            .then((r) => r.ok ? r.json() : [])
            .then((cs: Array<{ _id: string; contractCode: string }>) => {
              const c = cs.find((c) => c.contractCode === d.contractCode)
              if (c) setContractId(c._id)
            })
        }
      })
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

      {/* Quick links */}
      <div className="flex gap-3">
        {contractId && (
          <Link
            href={`/contracts/${contractId}`}
            className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2"
          >
            <FileText className="w-3.5 h-3.5" /> ดูสัญญา
          </Link>
        )}
        <Link
          href={`/trips?q=${data.contractCode}`}
          className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2"
        >
          <Truck className="w-3.5 h-3.5" /> ดูรายเที่ยว
        </Link>
        <Link
          href={`/promotions/${data.contractCode}`}
          className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> ดูโปรโมชั่น
        </Link>
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
