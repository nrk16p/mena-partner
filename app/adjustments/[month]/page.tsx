"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Save, ArrowLeft, CheckCircle2, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatMonth } from "@/lib/utils"

interface Adjustment {
  contractCode: string
  month: string
  otherIncomeWHT: number
  otherIncomeNoWHT: number
  otherDeductWHT: number
  otherDeductNoWHT: number
  note?: string
}

interface Driver {
  contractCode: string
  driverName: string
  plant: string
}

export default function AdjustmentsPage() {
  const { month } = useParams<{ month: string }>()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"

  const [drivers, setDrivers]         = useState<Driver[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>({})
  const [edits, setEdits]             = useState<Record<string, Partial<Adjustment>>>({})
  const [saving, setSaving]           = useState<string | null>(null)
  // netPay returned from API after recalc, shown as inline feedback
  const [netPayResult, setNetPayResult] = useState<Record<string, number | null>>({})
  const [q, setQ]                     = useState("")

  const load = useCallback(async () => {
    const [drvRes, adjRes] = await Promise.all([
      fetch("/api/drivers?status=active").then((r) => r.ok ? r.json() : []),
      fetch(`/api/adjustments?month=${month}`).then((r) => r.ok ? r.json() : []),
    ])
    setDrivers(drvRes)
    const adjMap: Record<string, Adjustment> = {}
    for (const a of adjRes) adjMap[a.contractCode] = a
    setAdjustments(adjMap)
  }, [month])

  useEffect(() => { load() }, [load])

  async function save(code: string) {
    if (!isAdmin) return
    const base = adjustments[code] ?? { contractCode: code, month, otherIncomeWHT: 0, otherIncomeNoWHT: 0, otherDeductWHT: 0, otherDeductNoWHT: 0 }
    const merged = { ...base, ...edits[code], contractCode: code, month }
    setSaving(code)
    try {
      const r = await fetch("/api/adjustments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      })
      if (r.ok) {
        const data = await r.json() as { ok: boolean; netPay: number | null }
        setAdjustments((prev) => ({ ...prev, [code]: merged as Adjustment }))
        setEdits((prev) => { const n = { ...prev }; delete n[code]; return n })
        setNetPayResult((prev) => ({ ...prev, [code]: data.netPay }))
        // Clear feedback after 4 seconds
        setTimeout(() => setNetPayResult((prev) => { const n = { ...prev }; delete n[code]; return n }), 4000)
      }
    } finally {
      setSaving(null)
    }
  }

  function fieldVal(code: string, field: keyof Adjustment): number {
    return (edits[code]?.[field] ?? adjustments[code]?.[field] ?? 0) as number
  }

  function setField(code: string, field: keyof Adjustment, val: string) {
    const num = parseFloat(val) || 0
    setEdits((prev) => ({ ...prev, [code]: { ...prev[code], [field]: num } }))
  }

  const filtered = drivers.filter((d) =>
    !q || d.contractCode.toLowerCase().includes(q.toLowerCase()) || d.driverName.toLowerCase().includes(q.toLowerCase())
  )

  const hasAny = (code: string) => {
    const a = adjustments[code]
    if (!a) return false
    return (a.otherIncomeWHT || a.otherIncomeNoWHT || a.otherDeductWHT || a.otherDeductNoWHT)
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/payroll/${month}`}>
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                รับ/หักอื่นๆ — {formatMonth(month)}
              </h1>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">บันทึกแล้วระบบคำนวณเงินเดือนใหม่อัตโนมัติ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/payroll/${month}`}>
            <Button variant="outline" size="sm">ดูสลิปเงินเดือน →</Button>
          </Link>
          <Link href="/admin/month">
            <Button variant="outline" size="sm">จัดการรอบ →</Button>
          </Link>
        </div>
      </div>

      <Input
        placeholder="ค้นหารหัสหรือชื่อ..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-72"
      />

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <th className="px-4 py-3 text-left text-zinc-500 font-medium w-28">รหัส</th>
              <th className="px-4 py-3 text-left text-zinc-500 font-medium">ชื่อ</th>
              <th className="px-4 py-3 text-right text-zinc-500 font-medium">รับอื่นๆ WHT</th>
              <th className="px-4 py-3 text-right text-zinc-500 font-medium">รับอื่นๆ NoWHT</th>
              <th className="px-4 py-3 text-right text-zinc-500 font-medium">หักอื่นๆ WHT</th>
              <th className="px-4 py-3 text-right text-zinc-500 font-medium">หักอื่นๆ NoWHT</th>
              <th className="px-4 py-3 text-right text-zinc-500 font-medium">Net Pay</th>
              {isAdmin && <th className="px-4 py-3 w-20" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const isDirty  = !!edits[d.contractCode]
              const feedback = netPayResult[d.contractCode]
              const filled   = hasAny(d.contractCode)
              return (
                <tr
                  key={d.contractCode}
                  className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${isDirty ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}
                >
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">{d.contractCode}</td>
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">
                    <span>{d.driverName}</span>
                    {filled && !isDirty && (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle" title="มีข้อมูล" />
                    )}
                  </td>
                  {(["otherIncomeWHT", "otherIncomeNoWHT", "otherDeductWHT", "otherDeductNoWHT"] as (keyof Adjustment)[]).map((field) => (
                    <td key={field} className="px-2 py-1 text-right">
                      {isAdmin ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={fieldVal(d.contractCode, field) || ""}
                          onChange={(e) => setField(d.contractCode, field, e.target.value)}
                          className="w-28 text-right text-sm h-7 px-2"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {formatMoney(fieldVal(d.contractCode, field))}
                        </span>
                      )}
                    </td>
                  ))}
                  {/* Net pay feedback column */}
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {feedback !== undefined && feedback !== null ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        {formatMoney(feedback)}
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-1 text-center">
                      <Button
                        size="sm"
                        variant={isDirty ? "default" : "outline"}
                        className={isDirty ? "bg-emerald-600 hover:bg-emerald-700 text-white h-7 w-12" : "h-7 w-12"}
                        onClick={() => save(d.contractCode)}
                        disabled={!isDirty || saving === d.contractCode}
                      >
                        {saving === d.contractCode ? (
                          <span className="text-[10px]">...</span>
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
