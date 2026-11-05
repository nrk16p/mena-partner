"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Trophy, Coins, TrendingUp, AlertTriangle, FileSpreadsheet, FileText, Wallet, Clock } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import { Skeleton, TableSkeleton, StatsSkeleton } from "@/components/ui/skeleton"
import { confirm } from "@/components/ui/confirm"
import { COMMISSION_TIERS, FIRST_TRANCHE, cycleEnd, cycleLabel, cycleOf, tierLabel, type CommissionSummary, type CommissionSale, type Payout } from "@/lib/commission"

type Payment = {
  _id: string; salesKey: string; salesName: string; cycle: string; cycleLabel: string; paidAt: string; note: string
  items: { quotationNo: string; tranche: 1 | 2; amount: number }[]; total: number; createdBy: { name: string }
}
type Resp = {
  role: string
  myEmail: string
  myName: string
  me: CommissionSummary | null
  all: CommissionSummary[]
  canSeeAll: boolean
  canPay: boolean
  payments: Payment[]
}

const fmtDate = (iso: string) => {
  if (!iso) return "—"
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit", ...(iso.length === 10 ? { timeZone: "UTC" } : {}) })
}
const today = () => new Date().toISOString().slice(0, 10)
const pickKey = (s: CommissionSale, t: 1 | 2) => `${s.quotationId}:${t}`

export default function CommissionPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [pick, setPick] = useState<string>("")   // key ของเซลที่แอดมินเลือกดู
  const [cycle, setCycle] = useState<string>("") // กรองรอบจ่าย ("" = ทุกรอบ)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [payCycle, setPayCycle] = useState<string>("") // รอบ/เดือนที่จ่าย ("" = ตามตัวกรอง หรือรอบของวันที่จ่าย)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState("")
  const [lastPayment, setLastPayment] = useState<Payment | null>(null)
  const [editingStart, setEditingStart] = useState<string>("")  // quotationId ที่กำลังแก้วันเริ่มสัญญา

  // ไม่ setLoading(true) ตอนรีเฟรช — โชว์ skeleton เฉพาะโหลดครั้งแรก (state ตั้งต้นเป็น true อยู่แล้ว)
  const load = (keepPick = true) => {
    return fetch("/api/quotations/commission")
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json())?.error ?? "โหลดข้อมูลไม่สำเร็จ"))))
      .then((j: Resp) => { setD(j); if (!keepPick || !pick) setPick(j.me?.key ?? j.all?.[0]?.key ?? "") })
      .catch((e) => setErr(String(e.message ?? e)))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false) }, [])

  const shown = d?.canSeeAll ? (d.all.find((r) => r.key === pick) ?? d.me ?? d.all[0] ?? null) : d?.me ?? null
  const isMe = !!shown && !!d?.me && shown.key === d.me.key

  // รอบที่มีในรายการของคนนี้ (เรียงใหม่→เก่า) + รอบปัจจุบัน
  const cycles = useMemo(() => {
    const set = new Set<string>([cycleOf(today())])
    for (const s of shown?.sales ?? []) for (const p of s.payouts) if (p.cycle) set.add(p.cycle)
    return [...set].sort().reverse()
  }, [shown])

  const rows = useMemo(() => {
    const list = shown?.sales ?? []
    if (!cycle) return list
    return list.filter((s) => s.payouts.some((p) => p.cycle === cycle))
  }, [shown, cycle])

  const payments = useMemo(() => (d?.payments ?? []).filter((p) => !shown || p.salesKey === shown.key), [d, shown])

  // งวดที่เลือกได้ = ยังไม่จ่าย (และตรงรอบที่กรอง ถ้ากรอง)
  const selectable = (p: Payout) => !p.paid && (!cycle || p.cycle === cycle)
  const selectedItems = useMemo(() => {
    const out: { sale: CommissionSale; payout: Payout }[] = []
    for (const s of shown?.sales ?? []) for (const p of s.payouts) if (sel.has(pickKey(s, p.tranche))) out.push({ sale: s, payout: p })
    return out
  }, [shown, sel])
  const selTotal = selectedItems.reduce((a, x) => a + x.payout.amount, 0)
  const toggle = (k: string) => setSel((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const selectAllDue = () => {
    const n = new Set<string>()
    const limit = cycle || cycleOf(today())
    for (const s of rows) for (const p of s.payouts) if (!p.paid && p.cycle && p.cycle <= limit) n.add(pickKey(s, p.tranche))
    setSel(n)
  }

  // รอบที่บันทึกลงใบทำจ่าย: เลือกเองในแถบล่าง > ตัวกรองรอบ > รอบของวันที่จ่าย
  const effectivePayCycle = payCycle || cycle || cycleOf(today())
  const paidAt = cycleEnd(effectivePayCycle)   // วันที่จ่าย = สิ้นเดือนของรอบเสมอ

  async function savePayment() {
    if (!shown || !selectedItems.length) return
    setSaveErr("")
    const ok = await confirm({
      title: `บันทึกทำจ่ายค่าคอม ${shown.name}`,
      description: `${selectedItems.length} งวด รวม ${formatMoney(selTotal)} บาท · วันที่จ่าย ${fmtDate(paidAt)} · ${cycleLabel(effectivePayCycle)} — บันทึกแล้วงวดเหล่านี้จะถูกล็อกว่าจ่ายแล้ว`,
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch("/api/quotations/commission/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesKey: shown.key, paidAt, note, cycle: effectivePayCycle,
          items: selectedItems.map((x) => ({ quotationId: x.sale.quotationId, tranche: x.payout.tranche })),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setSaveErr(j.error ?? "บันทึกไม่สำเร็จ"); return }
      setLastPayment(j.payment)
      setSel(new Set()); setNote("")
      await load()
    } finally { setSaving(false) }
  }

  async function saveContractStart(s: CommissionSale, value: string) {
    setEditingStart("")
    if (value === s.contractStart) return
    const res = await fetch(`/api/quotations/${s.quotationId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractStartDate: value }),
    })
    if (!res.ok) { setSaveErr("บันทึกวันเริ่มต้นสัญญาไม่สำเร็จ"); return }
    await load()
  }

  if (loading && !d) return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-8 w-52" />
      <StatsSkeleton count={4} />
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5"><TableSkeleton rows={6} cols={5} /></div>
    </div>
  )

  if (err) return (
    <div className="p-6 max-w-6xl mx-auto">
      <p className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{err}</p>
    </div>
  )

  const canPay = !!d?.canPay
  const exportHref = (id: string, f: "xlsx" | "pdf") => `/api/quotations/commission/payments/${id}/export?format=${f}`

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-28">
      <div className="flex items-center gap-2">
        <Link href="/quotations" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-lg font-semibold">ยอดขาย & ค่าคอมมิชชั่น</h1>
      </div>

      {lastPayment && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-4 py-3 text-sm flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">
            บันทึกทำจ่าย {lastPayment.salesName} · {lastPayment.cycleLabel} · {lastPayment.items.length} งวด รวม {formatMoney(lastPayment.total)} บาท แล้ว
          </span>
          <span className="ml-auto flex gap-2">
            <a href={exportHref(lastPayment._id, "xlsx")} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white dark:bg-zinc-900 text-[13px] font-semibold"><FileSpreadsheet className="w-4 h-4" /> Excel</a>
            <a href={exportHref(lastPayment._id, "pdf")} target="_blank" rel="noreferrer" className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white dark:bg-zinc-900 text-[13px] font-semibold"><FileText className="w-4 h-4" /> PDF</a>
            <button onClick={() => setLastPayment(null)} className="text-xs text-zinc-500 px-2">ปิด</button>
          </span>
        </div>
      )}

      {/* ── สรุปของคนที่กำลังดู ── */}
      {shown ? (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isMe ? "ของฉัน · " : ""}<span className="font-semibold text-zinc-800 dark:text-zinc-100">{shown.name}</span>
            </p>
            <div className="flex items-center gap-2">
              {d?.canSeeAll && d.all.length > 1 && (
                <select value={pick} onChange={(e) => { setPick(e.target.value); setSel(new Set()) }} aria-label="เลือกพนักงานขาย"
                  className="h-9 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 bg-white dark:bg-zinc-900">
                  {d.all.map((r) => <option key={r.key} value={r.key}>{r.name} ({r.count} คัน)</option>)}
                </select>
              )}
              <select value={cycle} onChange={(e) => { setCycle(e.target.value); setSel(new Set()) }} aria-label="รอบจ่าย"
                className="h-9 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 bg-white dark:bg-zinc-900">
                <option value="">ทุกรอบจ่าย</option>
                {cycles.map((c) => <option key={c} value={c}>{cycleLabel(c)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<Trophy className="w-4 h-4" />} label="ขายแล้ว" value={`${shown.count} คัน`} sub={`มูลค่า ${formatMoney(shown.salesValue)}`} />
            <Stat icon={<Coins className="w-4 h-4" />} label="ค่าคอมสะสม" value={formatMoney(shown.total)} sub={`จ่ายแล้ว ${formatMoney(shown.paidTotal)} · คงเหลือ ${formatMoney(shown.total - shown.paidTotal)}`} accent />
            <Stat icon={<Wallet className="w-4 h-4" />} label="ถึงกำหนดจ่าย" value={formatMoney(shown.dueTotal)} sub="บาท (ถึงรอบปัจจุบัน ยังไม่จ่าย)" warn={shown.dueTotal > 0} />
            <Stat icon={<TrendingUp className="w-4 h-4" />} label="อัตราคันถัดไป" value={formatMoney(shown.currentRate)}
              sub={shown.next ? `อีก ${shown.next.carsToNext} คัน ขึ้นเป็น ${formatMoney(shown.next.nextRate)}` : "ได้อัตราสูงสุดแล้ว"} />
          </div>

          {shown.unassigned && (
            <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" /> ใบเสนอราคากลุ่มนี้ไม่ได้ระบุผู้ขาย — ยังไม่ถูกนับเป็นค่าคอมของใคร กรุณาเติมชื่อผู้ขายในใบ
            </p>
          )}

          {/* ── รายคัน + งวดจ่าย ── */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-sm font-semibold">รายการที่ปิดการขาย</p>
              <p className="text-[11px] text-zinc-500">งวด 1 = {formatMoney(FIRST_TRANCHE)} เมื่อครบ 30 วันนับจากวันเริ่มต้นสัญญา · งวด 2 = ส่วนที่เหลือเมื่อครบ 90 วัน · ตัดรอบวันที่ 20</p>
              {canPay && rows.length > 0 && (
                <button onClick={selectAllDue} className="ml-auto h-8 px-3 text-[12px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                  เลือกงวดที่ถึงกำหนด{cycle ? ` (${cycleLabel(cycle)})` : ""}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">คันที่</th>
                    <th className="text-left px-3 py-2 font-semibold">วันเริ่มต้นสัญญา</th>
                    <th className="text-left px-3 py-2 font-semibold">ใบเสนอราคา</th>
                    <th className="text-left px-3 py-2 font-semibold">ลูกค้า</th>
                    <th className="text-left px-3 py-2 font-semibold">รถ</th>
                    <th className="text-right px-3 py-2 font-semibold">ราคาขาย</th>
                    <th className="text-right px-3 py-2 font-semibold">ค่าคอม</th>
                    <th className="text-left px-3 py-2 font-semibold">งวด 1 · 30 วัน</th>
                    <th className="text-left px-4 py-2 font-semibold">งวด 2 · 90 วัน</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-400">{cycle ? "ไม่มีงวดในรอบนี้" : "ยังไม่มีรายการปิดการขาย"}</td></tr>
                  )}
                  {rows.map((s) => (
                    <tr key={`${s.quotationNo}-${s.nth}`} className="border-t border-zinc-100 dark:border-zinc-800/70 align-top">
                      <td className="px-4 py-2 font-semibold tabular-nums">{s.nth}</td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {canPay && editingStart === s.quotationId ? (
                          <input type="date" autoFocus defaultValue={s.contractStart}
                            onBlur={(e) => saveContractStart(s, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingStart("") }}
                            className="h-8 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 bg-white dark:bg-zinc-900" />
                        ) : (
                          <button type="button" disabled={!canPay} onClick={() => setEditingStart(s.quotationId)} title={canPay ? "คลิกเพื่อแก้วันเริ่มต้นสัญญา" : undefined}
                            className={`tabular-nums ${canPay ? "underline decoration-dotted underline-offset-4 hover:text-zinc-900 dark:hover:text-white" : ""}`}>
                            {fmtDate(s.contractStart)}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {s.quotationId
                          ? <Link href={`/quotations/${s.quotationId}`} className="text-emerald-700 dark:text-emerald-400 hover:underline">{s.quotationNo}</Link>
                          : s.quotationNo}
                      </td>
                      <td className="px-3 py-2">{s.customerName || "—"}</td>
                      <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                        {s.licensePlate || "—"}{s.truckNumber ? ` · ${s.truckNumber}` : ""}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatMoney(s.salePrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatMoney(s.commission)}</td>
                      {[1, 2].map((t) => {
                        const p = s.payouts.find((x) => x.tranche === t)
                        return (
                          <td key={t} className={`px-3 py-2 ${t === 2 ? "pr-4" : ""}`}>
                            {!p ? <span className="text-zinc-300">—</span> : (
                              <PayoutCell p={p} dim={!!cycle && p.cycle !== cycle} canPay={canPay && selectable(p)}
                                checked={sel.has(pickKey(s, p.tranche))} onToggle={() => toggle(pickKey(s, p.tranche))} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── ประวัติทำจ่าย ── */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <p className="px-4 py-2.5 text-sm font-semibold border-b border-zinc-100 dark:border-zinc-800">ประวัติทำจ่าย · {shown.name}</p>
            {payments.length === 0 ? (
              <p className="px-4 py-5 text-sm text-zinc-400 text-center">ยังไม่เคยทำจ่าย</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-50/60 dark:bg-zinc-900/40">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">รอบจ่าย</th>
                      <th className="text-left px-3 py-2 font-semibold">วันที่จ่าย</th>
                      <th className="text-left px-3 py-2 font-semibold">รายการ</th>
                      <th className="text-right px-3 py-2 font-semibold">ยอดรวม</th>
                      <th className="text-left px-3 py-2 font-semibold">บันทึกโดย</th>
                      <th className="text-right px-4 py-2 font-semibold">ไฟล์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id} className="border-t border-zinc-100 dark:border-zinc-800/70">
                        <td className="px-4 py-2 font-medium">{p.cycleLabel}</td>
                        <td className="px-3 py-2 tabular-nums text-zinc-500 dark:text-zinc-400">{fmtDate(p.paidAt)}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                          {p.items.length} งวด · {p.items.map((i) => `${i.quotationNo}/${i.tranche}`).join(", ")}
                          {p.note && <span className="block text-xs">{p.note}</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(p.total)}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{p.createdBy?.name ?? "—"}</td>
                        <td className="px-4 py-2">
                          <span className="flex justify-end gap-1.5">
                            <a href={exportHref(p._id, "xlsx")} className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</a>
                            <a href={exportHref(p._id, "pdf")} target="_blank" rel="noreferrer" className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs"><FileText className="w-3.5 h-3.5" /> PDF</a>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-6 text-sm text-zinc-500 text-center">
          ยังไม่มีใบเสนอราคาที่ปิดการขายในชื่อคุณ — ปิดดีลแรกแล้วยอดจะขึ้นที่นี่
        </p>
      )}

      {/* ── สรุปทุกคน (แอดมิน) ── */}
      {d?.canSeeAll && d.all.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <p className="px-4 py-2.5 text-sm font-semibold border-b border-zinc-100 dark:border-zinc-800">สรุปทุกคน</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-50/60 dark:bg-zinc-900/40">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">พนักงานขาย</th>
                  <th className="text-right px-3 py-2 font-semibold">ขายได้</th>
                  <th className="text-right px-3 py-2 font-semibold">มูลค่าขาย</th>
                  <th className="text-right px-3 py-2 font-semibold">ค่าคอมสะสม</th>
                  <th className="text-right px-3 py-2 font-semibold">จ่ายแล้ว</th>
                  <th className="text-right px-4 py-2 font-semibold">ถึงกำหนด</th>
                </tr>
              </thead>
              <tbody>
                {d.all.map((r) => (
                  <tr key={r.key}
                    onClick={() => { setPick(r.key); setSel(new Set()) }}
                    className={`border-t border-zinc-100 dark:border-zinc-800/70 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${r.key === pick ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""}`}>
                    <td className="px-4 py-2 font-medium">
                      {r.name}
                      {r.unassigned && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">ไม่ระบุผู้ขาย</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.count} คัน</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatMoney(r.salesValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatMoney(r.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatMoney(r.paidTotal)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.dueTotal > 0 ? "text-[#9A6700] dark:text-amber-400" : "text-zinc-400"}`}>{formatMoney(r.dueTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── กติกา ── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
        <p className="text-sm font-semibold mb-2">อัตราค่าคอมมิชชั่น (สะสมตลอด ไม่รีเซ็ตรอบ)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COMMISSION_TIERS.map((t, i) => (
            <div key={i} className="rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-2">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{tierLabel(i)}</p>
              <p className="text-sm font-semibold tabular-nums">{formatMoney(t.rate)} <span className="text-[11px] font-normal text-zinc-400">บาท/คัน</span></p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
          นับเมื่อดีลถึงขั้น “เซ็นสัญญาแล้ว” (หรือใบเก่าที่ปิดการขาย) · แต่ละคันได้อัตราตามช่วงของคันนั้น (ไม่ย้อนปรับคันเก่า) ·
          จ่าย {formatMoney(FIRST_TRANCHE)} เมื่อครบ 30 วันนับจากวันเริ่มต้นสัญญา ส่วนที่เหลือเมื่อครบ 90 วัน · รอบจ่ายรายเดือน ตัดรอบวันที่ 20 (เลยวันที่ 20 ตกรอบเดือนถัดไป)
        </p>
      </div>

      {/* ── แถบทำจ่าย (ลอยล่าง) ── */}
      {canPay && shown && selectedItems.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
            <p className="text-sm">
              <span className="font-semibold">{shown.name}</span> · เลือก {selectedItems.length} งวด · รวม <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatMoney(selTotal)}</span> บาท
            </p>
            <label className="flex items-center gap-1.5 text-[13px] text-zinc-500">เดือนที่จ่าย
              <select value={effectivePayCycle} onChange={(e) => setPayCycle(e.target.value)} aria-label="เดือนที่จ่าย"
                className="h-9 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 bg-white dark:bg-zinc-900">
                {cycles.map((c) => <option key={c} value={c}>{cycleLabel(c)}</option>)}
              </select>
            </label>
            <span className="text-[13px] text-zinc-500">วันที่จ่าย <span className="font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">{fmtDate(paidAt)}</span> <span className="text-[11px]">(สิ้นเดือน)</span></span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ)"
              className="h-9 flex-1 min-w-[160px] text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 bg-white dark:bg-zinc-900" />
            {saveErr && <span className="text-[13px] text-red-600">{saveErr}</span>}
            <button onClick={() => setSel(new Set())} className="h-9 px-3 text-[13px] text-zinc-500">ล้าง</button>
            <button onClick={savePayment} disabled={saving || !paidAt}
              className="h-9 px-4 inline-flex items-center gap-2 gold-grad text-[#3F3000] text-sm font-semibold rounded-lg disabled:opacity-50">
              <Wallet className="w-4 h-4" /> {saving ? "กำลังบันทึก..." : "บันทึกทำจ่าย"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PayoutCell({ p, dim, canPay, checked, onToggle }: { p: Payout; dim: boolean; canPay: boolean; checked: boolean; onToggle: () => void }) {
  const overdue = !p.paid && !!p.due && p.due < today()
  return (
    <label className={`flex items-start gap-2 ${dim ? "opacity-40" : ""} ${canPay ? "cursor-pointer" : ""}`}>
      {canPay && <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 accent-[#031B14]" aria-label={`เลือกงวด ${p.tranche} ${p.amount} บาท`} />}
      <span className="min-w-0">
        <span className="block tabular-nums font-semibold">{formatMoney(p.amount)}</span>
        <span className="block text-[11px] text-zinc-500">{p.cycleLabel} · ครบ {fmtDate(p.due)}</span>
        {p.paid ? (
          <span className="inline-flex items-center gap-1 mt-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">จ่ายแล้ว {fmtDate(p.paid.paidAt)}</span>
        ) : overdue ? (
          <span className="inline-flex items-center gap-1 mt-0.5 rounded bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"><Clock className="w-3 h-3" /> ถึงกำหนด</span>
        ) : null}
      </span>
    </label>
  )
}

function Stat({ icon, label, value, sub, accent, warn }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean; warn?: boolean
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${accent
      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10"
      : warn ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10"
      : "border-zinc-200 dark:border-zinc-800"}`}>
      <p className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">{icon} {label}</p>
      <p className={`text-xl font-bold tabular-nums mt-0.5 ${accent ? "text-emerald-700 dark:text-emerald-400" : warn ? "text-[#9A6700] dark:text-amber-400" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>}
    </div>
  )
}
