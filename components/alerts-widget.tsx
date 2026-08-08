"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

type Alert = { type: string; severity: "critical" | "warning" | "info"; contractCode: string; driverName: string; message: string; value?: string }
const DOT: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", info: "#0ea5e9" }

/** วิดเจ็ต "ต้องดูด่วน" บนหน้าหลัก — ดึงจาก /api/alerts (เงินติดลบ/ประกันหมด/ค้างงวด/วงเงินซ่อมใกล้เต็ม) */
export function AlertsWidget() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  useEffect(() => { fetch("/api/alerts").then((r) => (r.ok ? r.json() : [])).then(setAlerts).catch(() => setAlerts([])) }, [])

  if (alerts === null) return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6"><Skeleton className="h-4 w-40" /><div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-5" />)}</div></div>
  )
  if (alerts.length === 0) return null

  const crit = alerts.filter((a) => a.severity === "critical").length
  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">ต้องดูด่วน ({alerts.length})</h2>
        {crit > 0 && <span className="text-[11px] font-semibold text-red-600 bg-red-100 dark:bg-red-950/40 rounded-full px-2 py-0.5">{crit} วิกฤต</span>}
      </div>
      <div className="space-y-1">
        {alerts.slice(0, 8).map((a, i) => (
          <Link key={i} href={`/drivers/360/${a.contractCode}`}
            className="flex items-center justify-between gap-3 text-sm px-2 py-1.5 rounded-lg hover:bg-white/70 dark:hover:bg-zinc-800/50">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOT[a.severity] }} />
              <span className="font-medium text-zinc-700 dark:text-zinc-200 truncate">{a.driverName}</span>
              <span className="text-zinc-400 truncate hidden sm:inline">· {a.message}</span>
            </span>
            {a.value && <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">{a.value}</span>}
          </Link>
        ))}
      </div>
      {alerts.length > 8 && <p className="text-xs text-zinc-400 mt-2 pl-2">+ อีก {alerts.length - 8} รายการ</p>}
    </div>
  )
}
