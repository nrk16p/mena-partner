"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Lock, CheckCircle, FileEdit, Eye, Upload, Calculator, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatMonth } from "@/lib/utils"

type Phase = "draft" | "review" | "approved" | "locked"

interface MonthStatus {
  month: string
  phase: Phase
  updatedAt: string
  updatedBy?: string
}

const PHASE_ORDER: Phase[] = ["draft", "review", "approved", "locked"]
const PHASE_LABEL: Record<Phase, string> = {
  draft:    "ร่าง",
  review:   "ตรวจสอบ",
  approved: "อนุมัติ",
  locked:   "ล็อค",
}
const PHASE_COLOR: Record<Phase, string> = {
  draft:    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  review:   "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  locked:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
}
const PHASE_ICON: Record<Phase, React.ReactNode> = {
  draft:    <FileEdit className="w-4 h-4" />,
  review:   <Eye className="w-4 h-4" />,
  approved: <CheckCircle className="w-4 h-4" />,
  locked:   <Lock className="w-4 h-4" />,
}

export default function AdminMonthPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"

  const [statuses, setStatuses] = useState<MonthStatus[]>([])
  const [payrollMonths, setPayrollMonths] = useState<string[]>([])
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [calculating, setCalculating] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/month-status").then((r) => r.ok ? r.json() : []),
      fetch("/api/payroll/months").then((r) => r.ok ? r.json() : []),
    ]).then(([s, m]) => {
      setStatuses(s)
      setPayrollMonths(m)
    })
  }, [])

  // Merge known months from payroll with status docs
  const monthSet = new Set([
    ...statuses.map((s) => s.month),
    ...payrollMonths,
  ])
  const months = Array.from(monthSet).sort((a, b) => b.localeCompare(a))

  function getStatus(month: string): MonthStatus {
    return statuses.find((s) => s.month === month) ?? { month, phase: "draft", updatedAt: "" }
  }

  async function advance(month: string, phase: Phase) {
    if (!isAdmin) return
    setAdvancing(month)
    try {
      await fetch("/api/month-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, phase }),
      })
      setStatuses((prev) => {
        const exists = prev.find((s) => s.month === month)
        if (exists) return prev.map((s) => s.month === month ? { ...s, phase, updatedAt: new Date().toISOString() } : s)
        return [...prev, { month, phase, updatedAt: new Date().toISOString() }]
      })
    } finally {
      setAdvancing(null)
    }
  }

  async function calculate(month: string) {
    if (!isAdmin) return
    setCalculating(month)
    try {
      const r = await fetch(`/api/payroll/calculate?month=${month}`, { method: "POST" })
      const data = await r.json()
      alert(`คำนวณเสร็จ: อัปเดต ${data.updated} ราย, ข้ามไป ${data.skipped} ราย, ผิดพลาด ${data.errors} ราย`)
    } finally {
      setCalculating(null)
    }
  }

  if (!isAdmin) {
    return <div className="p-8 text-zinc-400">เฉพาะผู้ดูแลระบบเท่านั้น</div>
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">จัดการรอบเดือน</h1>
        <p className="text-sm text-zinc-500 mt-1">ควบคุมสถานะ ตรวจสอบ อนุมัติ และล็อคข้อมูลเงินเดือนรายเดือน</p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/import">
          <Button variant="outline" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            นำเข้า Excel
          </Button>
        </Link>
        <Link href="/payroll">
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            ดูเงินเดือน
          </Button>
        </Link>
      </div>

      {months.length === 0 ? (
        <div className="text-zinc-400 text-sm">ไม่พบข้อมูลเดือน</div>
      ) : (
        <div className="space-y-3">
          {months.map((month) => {
            const status = getStatus(month)
            const idx    = PHASE_ORDER.indexOf(status.phase)
            const next   = PHASE_ORDER[idx + 1] as Phase | undefined
            const isLocked = status.phase === "locked"

            return (
              <div
                key={month}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-base font-semibold text-zinc-800 dark:text-zinc-200 w-28">
                      {formatMonth(month)}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${PHASE_COLOR[status.phase]}`}>
                      {PHASE_ICON[status.phase]}
                      {PHASE_LABEL[status.phase]}
                    </span>
                    {status.updatedBy && (
                      <span className="text-xs text-zinc-400">{status.updatedBy}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Phase pipeline visualization */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-400 mr-2">
                      {PHASE_ORDER.map((p, i) => (
                        <div key={p} className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded ${i <= idx ? "text-emerald-600 font-medium" : "text-zinc-300"}`}>
                            {PHASE_LABEL[p]}
                          </span>
                          {i < 3 && <ArrowRight className="w-3 h-3 text-zinc-300" />}
                        </div>
                      ))}
                    </div>

                    <Link href={`/payroll?month=${month}`}>
                      <Button variant="outline" size="sm">ดูเงินเดือน</Button>
                    </Link>
                    <Link href={`/adjustments/${month}`}>
                      <Button variant="outline" size="sm">ปรับแต่ง</Button>
                    </Link>

                    {!isLocked && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => calculate(month)}
                        disabled={calculating === month}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/30"
                      >
                        <Calculator className="w-3.5 h-3.5 mr-1" />
                        {calculating === month ? "คำนวณ..." : "คำนวณใหม่"}
                      </Button>
                    )}

                    {next && (
                      <Button
                        size="sm"
                        onClick={() => advance(month, next)}
                        disabled={advancing === month}
                        className={
                          next === "locked"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }
                      >
                        {next === "review"    && <><Eye className="w-3.5 h-3.5 mr-1" />ส่งตรวจสอบ</>}
                        {next === "approved"  && <><CheckCircle className="w-3.5 h-3.5 mr-1" />อนุมัติ</>}
                        {next === "locked"    && <><Lock className="w-3.5 h-3.5 mr-1" />ล็อคข้อมูล</>}
                      </Button>
                    )}

                    {isLocked && idx > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => advance(month, PHASE_ORDER[idx - 1])}
                        className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400"
                        disabled={advancing === month}
                      >
                        ปลดล็อค
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
