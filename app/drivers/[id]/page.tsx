"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { FileText, ShieldCheck, Truck, ClipboardList } from "lucide-react"
import type { Driver, PayrollEntry } from "@/types"
import { formatMoney, formatMonth } from "@/lib/utils"

type DriverWithHistory = Driver & { payrollHistory: PayrollEntry[] }

type DebtAcceptance = {
  _id: string
  debtAcceptanceNo: string
  repairOrderNo: string
  repairType: string
  issueDate: string
  startDate: string
  endDate: string
  liabilityAmount: number
  installmentCount: number
  monthlyInstallment: number
  status: string
  description: string
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const [data, setData]       = useState<DriverWithHistory | null>(null)
  const [contractId, setContractId] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [debts, setDebts]     = useState<DebtAcceptance[]>([])
  const [debtTotal, setDebtTotal] = useState(0)

  useEffect(() => {
    fetch(`/api/drivers/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setData(d)
          fetch(`/api/contracts?q=${encodeURIComponent(d.contractCode)}`)
            .then((r) => r.ok ? r.json() : [])
            .then((cs: Array<{ _id: string; contractCode: string }>) => {
              const c = cs.find((c) => c.contractCode === d.contractCode)
              if (c) setContractId(c._id)
            })
          fetch(`/api/debt-acceptances/${encodeURIComponent(d.contractCode)}`)
            .then((r) => r.ok ? r.json() : { docs: [], total: 0 })
            .then(({ docs, total }: { docs: DebtAcceptance[]; total: number }) => {
              setDebts(docs)
              setDebtTotal(total)
            })
        }
      })
  }, [id])

  async function toggleStatus() {
    if (!data || !isAdmin) return
    const next = data.status === "active" ? "inactive" : "active"
    if (!confirm(`เปลี่ยนสถานะเป็น${next === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}?`)) return
    setToggling(true)
    try {
      const r = await fetch(`/api/drivers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (r.ok) setData((p) => p ? { ...p, status: next as Driver["status"] } : p)
    } finally { setToggling(false) }
  }

  if (!data) return <div className="text-zinc-400 text-sm">กำลังโหลด...</div>

  const history = [...data.payrollHistory].sort((a, b) => a.month.localeCompare(b.month))
  const maxNet = history.length ? Math.max(...history.map((p) => Math.abs(p.netPay))) : 0

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{data.driverName}</h1>
          <p className="text-sm text-zinc-400">{data.contractCode} · {data.licensePlate} · {data.plant}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              data.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
            }`}>
              {data.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
            </span>
            {isAdmin && (
              <button
                onClick={toggleStatus}
                disabled={toggling}
                className="text-xs text-zinc-400 hover:text-zinc-600 underline"
              >
                {data.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4">
        {([
          ["ชื่อผู้เช่าซื้อ", data.buyerName],
          ["เบอร์โทร", data.phone],
          ["เบอร์รถ", data.truckNumber],
          ["แพล้นท์", data.plant],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className="text-sm font-medium">{value || "-"}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        {contractId && (
          <Link href={`/contracts/${contractId}`}
            className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2">
            <FileText className="w-3.5 h-3.5" /> ดูสัญญา
          </Link>
        )}
        <Link href={`/trips?q=${data.contractCode}`}
          className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2">
          <Truck className="w-3.5 h-3.5" /> รายเที่ยว
        </Link>
        <Link href={`/payroll?q=${data.contractCode}`}
          className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2">
          <ClipboardList className="w-3.5 h-3.5" /> เงินเดือน
        </Link>
        <Link href={`/promotions/${data.contractCode}`}
          className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2">
          <ShieldCheck className="w-3.5 h-3.5" /> โปรโมชั่น
        </Link>
      </div>

      {/* Payroll trend mini-chart */}
      {history.length > 1 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">แนวโน้มรับสุทธิ</p>
          <div className="flex items-end gap-2 h-16">
            {history.map((p) => {
              const heightPct = maxNet > 0 ? Math.abs(p.netPay) / maxNet : 0
              const isNeg = p.netPay < 0
              return (
                <div key={p.month} className="flex flex-col items-center gap-1 flex-1 group" title={`${formatMonth(p.month)}: ${formatMoney(p.netPay)}`}>
                  <div className="w-full flex items-end justify-center" style={{ height: "56px" }}>
                    <div
                      className={`w-full rounded-t transition-all ${isNeg ? "bg-red-400" : "bg-emerald-400 group-hover:bg-emerald-500"}`}
                      style={{ height: `${Math.max(4, heightPct * 56)}px` }}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-400">{formatMonth(p.month).split(" ")[0]}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {history.slice(-1).map((p) => (
              <div key="latest">
                <p className="text-[10px] text-zinc-400">รับสุทธิล่าสุด</p>
                <p className={`text-sm font-bold ${p.netPay < 0 ? "text-red-500" : "text-emerald-600"}`}>{formatMoney(p.netPay)}</p>
              </div>
            ))}
            <div>
              <p className="text-[10px] text-zinc-400">เฉลี่ย (6 เดือน)</p>
              <p className="text-sm font-semibold text-zinc-600">
                {formatMoney(history.reduce((s, p) => s + p.netPay, 0) / history.length)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Debt acceptances */}
      {debts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">หนี้รับสภาพซ่อม</h2>
            <span className="text-xs text-red-500 font-semibold">ยอดรวม {formatMoney(debtTotal)}</span>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">เลขที่เอกสาร</th>
                  <th className="px-4 py-3 text-left">ประเภท</th>
                  <th className="px-4 py-3 text-left">เริ่มชำระ</th>
                  <th className="px-4 py-3 text-right">ยอดรับผิด</th>
                  <th className="px-4 py-3 text-right">งวด</th>
                  <th className="px-4 py-3 text-right">เดือนละ</th>
                  <th className="px-4 py-3 text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {debts.map((d) => (
                  <tr key={d._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{d.debtAcceptanceNo}</td>
                    <td className="px-4 py-3 text-xs">{d.repairType}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{d.startDate}</td>
                    <td className="px-4 py-3 text-right text-red-500 font-medium">{formatMoney(d.liabilityAmount)}</td>
                    <td className="px-4 py-3 text-right text-zinc-400 text-xs">{d.installmentCount}</td>
                    <td className="px-4 py-3 text-right text-xs">{formatMoney(d.monthlyInstallment)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{d.status || "ค้างชำระ"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll history table */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-3">ประวัติเงินเดือน</h2>
        {data.payrollHistory.length === 0 ? (
          <p className="text-sm text-zinc-400">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">เดือน</th>
                  <th className="px-4 py-3 text-right">เที่ยว</th>
                  <th className="px-4 py-3 text-right">รายรับ</th>
                  <th className="px-4 py-3 text-right">รายหัก</th>
                  <th className="px-4 py-3 text-right">สุทธิ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...data.payrollHistory].sort((a, b) => b.month.localeCompare(a.month)).map((p) => (
                  <tr key={p._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">{formatMonth(p.month)}</td>
                    <td className="px-4 py-3 text-right text-zinc-400 text-xs">{p.tripCount}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(p.totalIncome)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{formatMoney(p.totalDeductions)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${p.netPay < 0 ? "text-red-600" : ""}`}>{formatMoney(p.netPay)}</td>
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
