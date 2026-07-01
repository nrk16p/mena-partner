"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Save, ArrowLeft } from "lucide-react"
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
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"

  const [drivers, setDrivers]         = useState<Driver[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>({})
  const [edits, setEdits]             = useState<Record<string, Partial<Adjustment>>>({})
  const [saving, setSaving]           = useState<string | null>(null)
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
        setAdjustments((prev) => ({ ...prev, [code]: merged as Adjustment }))
        setEdits((prev) => { const n = { ...prev }; delete n[code]; return n })
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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            รายได้/หักอื่นๆ — {formatMonth(month)}
          </h1>
          <p className="text-xs text-zinc-500">ปรับแต่งรายได้และรายหักพิเศษรายคน</p>
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
              {isAdmin && <th className="px-4 py-3 w-20" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const isDirty = !!edits[d.contractCode]
              return (
                <tr key={d.contractCode} className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${isDirty ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">{d.contractCode}</td>
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">{d.driverName}</td>
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
                  {isAdmin && (
                    <td className="px-2 py-1 text-center">
                      <Button
                        size="sm"
                        variant={isDirty ? "default" : "outline"}
                        className={isDirty ? "bg-emerald-600 hover:bg-emerald-700 text-white h-7" : "h-7"}
                        onClick={() => save(d.contractCode)}
                        disabled={!isDirty || saving === d.contractCode}
                      >
                        <Save className="w-3 h-3" />
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
