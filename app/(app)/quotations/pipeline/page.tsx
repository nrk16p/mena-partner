"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Filter } from "lucide-react"
import { StatsSkeleton } from "@/components/ui/skeleton"

/**
 * แดชบอร์ดไปป์ไลน์ขายรถร่วม — 8 มุมมองตามสเปก
 * ตัวเลขคำนวณที่ lib/deal-metrics (มีเทสต์) หน้านี้แค่แสดงผล
 */

interface Dash {
  total: number
  openByStage: { stage: string; label: string; active: number; onHold: number }[]
  lostByStage: { stage: string; label: string; count: number }[]
  lossReasonByMonth: { month: string; reasons: { label: string; count: number }[] }[]
  avgDaysPerStage: { stage: string; label: string; days: number; samples: number }[]
  trainingToDelivered: { passed: number; delivered: number; rate: number }
  signedToCompleted: { eligible: number; completed: number; rate: number }
  funnel: { stage: string; label: string; count: number; rateFromPrev: number }[]
  followUpOverdue: { id: string; quotationNo: string; salesName: string; nextFollowUpDate: string; overdueDays: number }[]
  salesPeople: string[]
  sourceChannels: string[]
}

const THM = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const monthLabel = (m: string) => { const [y, mo] = m.split("-").map(Number); return `${THM[mo] ?? mo} ${String((y + 543) % 100).padStart(2, "0")}` }
const pct = (n: number) => `${Math.round(n * 100)}%`

export default function PipelineDashboardPage() {
  const [d, setD] = useState<Dash | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [sales, setSales] = useState("")
  const [source, setSource] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (from) p.set("from", from)
    if (to) p.set("to", to)
    if (sales) p.set("sales", sales)
    if (source) p.set("source", source)
    fetch(`/api/deals/dashboard?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      // โหลดข้อมูลตอน mount/เปลี่ยนตัวกรอง — ไม่ใช่ cascading render
      // eslint-disable-next-line react-hooks/set-state-in-effect
      .then(setD)
      .finally(() => setLoading(false))
  }, [from, to, sales, source])
  useEffect(() => { load() }, [load])

  const input = "h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
  const maxOpen = Math.max(1, ...(d?.openByStage.map((r) => r.active + r.onHold) ?? [1]))
  const maxLost = Math.max(1, ...(d?.lostByStage.map((r) => r.count) ?? [1]))
  const maxDays = Math.max(1, ...(d?.avgDaysPerStage.map((r) => r.days) ?? [1]))
  const maxFunnel = Math.max(1, ...(d?.funnel.map((r) => r.count) ?? [1]))

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/quotations" className="text-zinc-400 hover:text-zinc-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">แดชบอร์ดไปป์ไลน์ขาย</h1>
          <p className="text-xs text-zinc-400 mt-0.5">ดีลทั้งหมดในช่วงที่เลือก {d ? `${d.total} ใบ` : ""}</p>
        </div>
      </div>

      {/* ตัวกรอง */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3">
        <Filter className="w-4 h-4 text-zinc-400" />
        <label className="text-xs text-zinc-500">ตั้งแต่ <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-zinc-500">ถึง <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <select className={input} value={sales} onChange={(e) => setSales(e.target.value)}>
          <option value="">เซลล์ทุกคน</option>
          {d?.salesPeople.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(d?.sourceChannels.length ?? 0) > 0 && (
          <select className={input} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">ทุกช่องทาง</option>
            {d?.sourceChannels.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {(from || to || sales || source) && (
          <button onClick={() => { setFrom(""); setTo(""); setSales(""); setSource("") }} className="text-xs text-emerald-600 underline underline-offset-2">ล้างตัวกรอง</button>
        )}
      </div>

      {loading || !d ? <StatsSkeleton /> : (
        <>
          {/* อัตราสำคัญ 2 ตัว */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card title="ผ่านฝึกงาน → รับรถจริง"
              hint={`ผ่านฝึก ${d.trainingToDelivered.passed} ใบ · รับรถแล้ว ${d.trainingToDelivered.delivered} ใบ`}>
              <p className="text-3xl font-bold text-emerald-600 tabular-nums">{pct(d.trainingToDelivered.rate)}</p>
            </Card>
            <Card title="เซ็นสัญญา → อยู่ครบ 90 วัน"
              hint={`นับเฉพาะที่เซ็นมาแล้วเกิน 90 วัน ${d.signedToCompleted.eligible} ใบ · ครบแล้ว ${d.signedToCompleted.completed} ใบ`}>
              <p className="text-3xl font-bold text-emerald-600 tabular-nums">{pct(d.signedToCompleted.rate)}</p>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="ดีลค้างแต่ละขั้น" hint="แถบจาง = พักติดตาม (นับตามขั้นเดิม)">
              <div className="space-y-2">
                {d.openByStage.map((r) => (
                  <div key={r.stage} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-zinc-500 truncate">{r.label}</span>
                    <div className="flex-1 flex h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="bg-emerald-500" style={{ width: `${(r.active / maxOpen) * 100}%` }} />
                      <div className="bg-amber-300" style={{ width: `${(r.onHold / maxOpen) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right tabular-nums">{r.active}{r.onHold ? ` +${r.onHold}` : ""}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="ดีลหลุดที่ขั้นไหน" hint={d.lostByStage.length ? "" : "ยังไม่มีดีลที่ปิดไม่สำเร็จในช่วงนี้"}>
              <div className="space-y-2">
                {d.lostByStage.map((r) => (
                  <div key={r.stage} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-zinc-500 truncate">{r.label}</span>
                    <div className="flex-1 h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-zinc-500" style={{ width: `${(r.count / maxLost) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums">{r.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="เวลาเฉลี่ยที่ค้างแต่ละขั้น" hint="วัน · คิดจากประวัติการเปลี่ยนขั้น">
              <div className="space-y-2">
                {d.avgDaysPerStage.map((r) => (
                  <div key={r.stage} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-zinc-500 truncate">{r.label}</span>
                    <div className="flex-1 h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-sky-500" style={{ width: `${(r.days / maxDays) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right tabular-nums">{r.days} วัน</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="อัตราผ่านแต่ละขั้น (funnel)" hint="เคยถึงขั้นนั้นกี่ใบ · % เทียบขั้นก่อนหน้า">
              <div className="space-y-1.5">
                {d.funnel.map((r) => (
                  <div key={r.stage} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-zinc-500 truncate">{r.label}</span>
                    <div className="flex-1 h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${(r.count / maxFunnel) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums">{r.count}</span>
                    <span className="w-12 text-right tabular-nums text-zinc-400">{pct(r.rateFromPrev)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="เหตุผลที่ดีลหลุด รายเดือน">
            {d.lossReasonByMonth.length === 0 ? <p className="text-sm text-zinc-400">ยังไม่มีข้อมูล</p> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {d.lossReasonByMonth.slice(0, 6).map((m) => (
                  <div key={m.month}>
                    <p className="text-xs font-semibold text-zinc-500 mb-1">{monthLabel(m.month)}</p>
                    <ul className="space-y-1">
                      {m.reasons.map((r) => (
                        <li key={r.label} className="flex justify-between text-sm">
                          <span className="truncate pr-2">{r.label}</span>
                          <span className="tabular-nums text-zinc-500">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="ดีลพักติดตามที่เลยวันนัดแล้ว" hint="เรียงค้างนานสุดก่อน">
            {d.followUpOverdue.length === 0 ? <p className="text-sm text-zinc-400">ไม่มีดีลที่เลยวันติดตาม</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-zinc-400 text-left">
                  <th className="py-1">เลขที่</th><th>เซลล์</th><th>นัดติดตาม</th><th className="text-right">เลยมา</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {d.followUpOverdue.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5"><Link href={`/quotations/${r.id}`} className="font-mono text-[#8C6B1F] hover:underline">{r.quotationNo}</Link></td>
                      <td className="text-zinc-500">{r.salesName}</td>
                      <td className="text-zinc-500 tabular-nums">{r.nextFollowUpDate}</td>
                      <td className="text-right tabular-nums text-amber-600 font-semibold">{r.overdueDays} วัน</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4">
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="text-xs text-zinc-400 mt-0.5 mb-3">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </div>
  )
}
