"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, TrendingUp, Trophy, Clock, Filter } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import { Skeleton, TableSkeleton, StatsSkeleton } from "@/components/ui/skeleton"

const ST: Record<string, { label: string; color: string }> = {
  lead: { label: "สนใจ", color: "#a1a1aa" },
  quoted: { label: "เสนอราคาแล้ว", color: "#C9A227" },
  booked: { label: "วางจอง", color: "#0ea5e9" },
  won: { label: "ปิดการขาย", color: "#10b981" },
  lost: { label: "ยกเลิก", color: "#ef4444" },
}
const THM = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const monthLabel = (m: string) => { const [y, mo] = m.split("-").map(Number); return `${THM[mo] ?? mo} ${String((y + 543) % 100).padStart(2, "0")}` }

interface Dash {
  total: number; pipelineValue: number; wonCount: number; wonValue: number; winRate: number
  funnel: { status: string; count: number; value: number }[]
  leaderboard: { name: string; deals: number; won: number; wonValue: number; pipeline: number; winRate: number }[]
  monthly: { month: string; deals: number; value: number; won: number }[]
  aging: { bucket: string; count: number; value: number }[]
  stale: { id: string; quotationNo: string; customerName: string; status: string; licensePlate: string; salesName: string; value: number; days: number }[]
}

export default function DashboardPage() {
  const [d, setD] = useState<Dash | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/quotations/dashboard").then((r) => (r.ok ? r.json() : null)).then((j) => { setD(j); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-8 w-52" />
      <StatsSkeleton count={5} />
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5"><TableSkeleton rows={5} cols={4} /></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5"><TableSkeleton rows={4} cols={2} /></div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5"><TableSkeleton rows={4} cols={2} /></div>
      </div>
    </div>
  )
  if (!d) return <div className="p-8 text-sm text-red-500">โหลดข้อมูลไม่สำเร็จ</div>

  const funnelMax = Math.max(1, ...d.funnel.map((f) => f.count))
  const monthMax = Math.max(1, ...d.monthly.map((m) => m.deals))
  const agingTone = ["#10b981", "#C9A227", "#f59e0b", "#ef4444"]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/quotations" className="text-zinc-400 hover:text-zinc-700"><ArrowLeft className="w-5 h-5" /></Link>
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">ระบบขาย</p>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-[#C9A227]" /> แดชบอร์ดงานขาย</h1>
        <Link href="/quotations" className="text-sm border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg">ดูรายการดีล →</Link>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="ดีลทั้งหมด" value={String(d.total)} />
        <Stat label="มูลค่า pipeline" value={formatMoney(d.pipelineValue)} sub="ยังไม่ปิด" />
        <Stat label="ปิดการขาย" value={`${d.wonCount} ดีล`} tone />
        <Stat label="มูลค่าปิดได้" value={formatMoney(d.wonValue)} tone />
        <Stat label="อัตราปิดการขาย" value={`${d.winRate}%`} sub="จากดีลที่ปิดแล้ว" />
      </div>

      {/* funnel */}
      <Card title="Funnel · ช่องทางการขาย" icon={<Filter className="w-4 h-4" />}>
        <div className="space-y-2.5">
          {d.funnel.map((f) => (
            <div key={f.status} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-sm text-zinc-600">{ST[f.status]?.label ?? f.status}</div>
              <div className="flex-1 h-3 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.round((f.count / funnelMax) * 100)}%`, minWidth: f.count ? 6 : 0, background: ST[f.status]?.color }} />
              </div>
              <div className="w-12 text-right tabular-nums text-sm font-semibold">{f.count}</div>
              <div className="w-28 text-right tabular-nums text-xs text-zinc-400 hidden sm:block">{formatMoney(f.value)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {/* monthly trend */}
        <Card title="แนวโน้มรายเดือน" icon={<TrendingUp className="w-4 h-4" />}>
          {d.monthly.length === 0 ? <Empty /> : (
            <div className="flex items-end gap-2 h-36 pt-2">
              {d.monthly.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="text-[10px] tabular-nums text-zinc-500">{m.deals}</div>
                  <div className="w-full rounded-t" style={{ height: `${Math.round((m.deals / monthMax) * 100)}%`, minHeight: 4, background: "linear-gradient(180deg,#E7C86E,#C9A227)" }} title={`${m.deals} ดีล · ${formatMoney(m.value)}`} />
                  <div className="text-[10px] text-zinc-400 whitespace-nowrap">{monthLabel(m.month)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* aging */}
        <Card title="อายุดีลที่ยังไม่ปิด (Aging)" icon={<Clock className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-2.5">
            {d.aging.map((a, i) => (
              <div key={a.bucket} className="rounded-xl border border-zinc-100 p-3" style={{ borderLeft: `3px solid ${agingTone[i]}` }}>
                <div className="text-xs text-zinc-500">{a.bucket}</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: agingTone[i] }}>{a.count} <span className="text-sm font-normal text-zinc-400">ดีล</span></div>
                <div className="text-[11px] tabular-nums text-zinc-400">{formatMoney(a.value)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* leaderboard */}
      <Card title="ผลงานรายพนักงานขาย" icon={<Trophy className="w-4 h-4" />} className="mt-4">
        {d.leaderboard.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-xs text-zinc-400 border-b border-zinc-100">
                <th className="text-left font-medium py-2 pl-1">พนักงานขาย</th>
                <th className="text-right font-medium py-2">ดีล</th>
                <th className="text-right font-medium py-2">ปิดได้</th>
                <th className="text-right font-medium py-2">มูลค่าปิด</th>
                <th className="text-right font-medium py-2">อัตราปิด</th>
                <th className="text-right font-medium py-2 pr-1">Pipeline</th>
              </tr></thead>
              <tbody>
                {d.leaderboard.map((r, i) => (
                  <tr key={r.name} className="border-b border-zinc-50">
                    <td className="py-2 pl-1"><span className="text-zinc-400 tabular-nums mr-1.5">{i + 1}.</span>{r.name}</td>
                    <td className="text-right tabular-nums py-2">{r.deals}</td>
                    <td className="text-right tabular-nums py-2 font-semibold text-emerald-600">{r.won}</td>
                    <td className="text-right tabular-nums py-2">{formatMoney(r.wonValue)}</td>
                    <td className="text-right tabular-nums py-2">{r.winRate}%</td>
                    <td className="text-right tabular-nums py-2 pr-1 text-zinc-500">{formatMoney(r.pipeline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* stale deals */}
      <Card title={`ดีลค้าง / ต้องตามต่อ (≥ 14 วัน)`} icon={<Clock className="w-4 h-4" />} className="mt-4">
        {d.stale.length === 0 ? <div className="text-sm text-emerald-600 py-2">✓ ไม่มีดีลค้าง — ทุกดีลอัปเดตภายใน 14 วัน</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead><tr className="text-xs text-zinc-400 border-b border-zinc-100">
                <th className="text-left font-medium py-2 pl-1">เลขที่</th>
                <th className="text-left font-medium py-2">ลูกค้า</th>
                <th className="text-left font-medium py-2">สถานะ</th>
                <th className="text-right font-medium py-2">ค้าง</th>
                <th className="text-right font-medium py-2">มูลค่า</th>
                <th className="text-left font-medium py-2 pl-3">ขายโดย</th>
              </tr></thead>
              <tbody>
                {d.stale.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="py-2 pl-1"><Link href={`/quotations/${s.id}`} className="text-[#8C6B1F] hover:underline tabular-nums">{s.quotationNo}</Link></td>
                    <td className="py-2">{s.customerName}<span className="text-zinc-400 text-xs ml-1">{s.licensePlate}</span></td>
                    <td className="py-2"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: (ST[s.status]?.color ?? "#999") + "22", color: ST[s.status]?.color }}>{ST[s.status]?.label ?? s.status}</span></td>
                    <td className="text-right tabular-nums py-2 font-semibold" style={{ color: s.days >= 30 ? "#ef4444" : "#f59e0b" }}>{s.days} วัน</td>
                    <td className="text-right tabular-nums py-2">{formatMoney(s.value)}</td>
                    <td className="py-2 pl-3 text-zinc-500 text-xs">{s.salesName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-1 ${tone ? "text-emerald-600" : "text-zinc-800"}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}
function Card({ title, icon, children, className = "" }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-zinc-700"><span className="text-[#C9A227]">{icon}</span>{title}</div>
      {children}
    </div>
  )
}
function Empty() { return <div className="text-sm text-zinc-300 py-4 text-center">ยังไม่มีข้อมูล</div> }
