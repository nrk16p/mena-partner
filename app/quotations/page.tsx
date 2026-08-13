"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { FileText, Plus, Search, X, ExternalLink, LayoutGrid, List, TrendingUp } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import { SALES_PEOPLE } from "@/lib/quotation-people"
import { Skeleton } from "@/components/ui/skeleton"

type Status = "lead" | "quoted" | "booked" | "won" | "lost"
const STATUS: { key: Status; label: string; cls: string }[] = [
  { key: "lead",   label: "สนใจ",         cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300" },
  { key: "quoted", label: "เสนอราคาแล้ว", cls: "bg-amber-100 text-amber-700" },
  { key: "booked", label: "วางจอง",       cls: "bg-sky-100 text-sky-700" },
  { key: "won",    label: "ปิดการขาย",     cls: "bg-emerald-100 text-emerald-700" },
  { key: "lost",   label: "ยกเลิก",        cls: "bg-red-100 text-red-600" },
]
const stMeta = (s: string) => STATUS.find((x) => x.key === s) ?? STATUS[1]

interface Quote {
  _id: string; quotationNo: string; status: Status
  customerName: string; customerPhone?: string
  licensePlate: string; vehicleBrand?: string; vehicleModel?: string
  totalSalePrice: number; monthlyPayment: number; depositAmount?: number
  salesName: string; createdAt: string
}
interface PriceRow {
  licensePlate: string; status: string; saleStatus: string | null
  vehicleBrand?: string; vehicleModel?: string; truckNumber?: string; photoUrl?: string
  photos?: { front?: string; back?: string; left?: string; right?: string; cabin?: string }
  totalSalePrice: number; downPayment: number; cashDown: number; remainingInstallment: number
  downInstallmentCount: number; downInstallmentAmt: number
  financeAmount: number; financeInstallments: number; monthlyPayment: number
}
interface Customer { _id: string; name: string; phone?: string }

function QuotationsInner() {
  const sp = useSearchParams()
  const [rows, setRows] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | "">("")
  const [q, setQ] = useState("")
  const [formMode, setFormMode] = useState<"lead" | "quote" | null>(null)
  const [view, setView] = useState<"list" | "kanban">("list")

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (filter) p.set("status", filter)
    if (q) p.set("q", q)
    fetch(`/api/quotations?${p}`).then((r) => r.ok ? r.json() : []).then((d) => setRows(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }, [filter, q])
  useEffect(load, [load])

  // deep-link จาก price-list: /quotations?vehicle=<ทะเบียน> → เปิดฟอร์มพร้อมรถ
  const presetPlate = sp.get("vehicle") ?? ""
  useEffect(() => { if (presetPlate) setFormMode("quote") }, [presetPlate])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1 })
    return c
  }, [rows])

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">ระบบขาย</p>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-[#C9A227]" /> ระบบขาย</h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">คนขายเลือกรถพร้อมขาย → ออกใบเสนอราคา → ติดตามดีล (ทั้งทีมเห็นทุกดีล)</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/quotations/dashboard" className="flex items-center gap-2 border border-zinc-300 text-zinc-700 dark:text-zinc-200 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <TrendingUp className="w-4 h-4 text-[#C9A227]" /> แดชบอร์ด
          </Link>
          <button onClick={() => setFormMode("lead")} className="flex items-center gap-2 border border-zinc-300 text-zinc-700 dark:text-zinc-200 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <Plus className="w-4 h-4" /> ลูกค้าสนใจ (Lead)
          </button>
          <button onClick={() => setFormMode("quote")} className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
            <Plus className="w-4 h-4" /> สร้างใบเสนอราคา
          </button>
        </div>
      </div>

      {/* Dashboard ยอดขาย */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="ดีลทั้งหมด" value={String(rows.length)} />
        <Stat label="มูลค่า pipeline (ยังไม่ปิด)" value={formatMoney(rows.filter((r) => r.status !== "won" && r.status !== "lost").reduce((s, r) => s + r.totalSalePrice, 0))} />
        <Stat label="ปิดการขายแล้ว" value={`${counts.won ?? 0} ดีล`} tone="good" />
        <Stat label="มูลค่าปิดได้" value={formatMoney(rows.filter((r) => r.status === "won").reduce((s, r) => s + r.totalSalePrice, 0))} tone="good" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="ml-auto flex items-center gap-1 order-last">
          <button onClick={() => setView("list")} className={`p-1.5 rounded-lg ${view === "list" ? "bg-zinc-900 dark:bg-zinc-100 text-white" : "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`} title="ตาราง"><List className="w-4 h-4" /></button>
          <button onClick={() => setView("kanban")} className={`p-1.5 rounded-lg ${view === "kanban" ? "bg-zinc-900 dark:bg-zinc-100 text-white" : "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`} title="กระดานดีล"><LayoutGrid className="w-4 h-4" /></button>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เลขที่/ลูกค้า/ทะเบียน/เซลล์"
            className="h-8 w-64 text-sm pl-8 pr-3 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900" />
        </div>
        <span className="w-px h-5 bg-zinc-200 mx-1" />
        <button onClick={() => setFilter("")} className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === "" ? "bg-zinc-900 dark:bg-zinc-100 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>ทั้งหมด ({rows.length})</button>
        {STATUS.map((s) => (
          <button key={s.key} onClick={() => setFilter(filter === s.key ? "" : s.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === s.key ? "bg-zinc-900 dark:bg-zinc-100 text-white" : s.cls}`}>
            {s.label} ({counts[s.key] ?? 0})
          </button>
        ))}
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {STATUS.map((col) => (
            <div key={col.key} className="bg-zinc-50 dark:bg-zinc-900/40 rounded-xl p-2 min-h-[120px]">
              <div className={`text-[11px] font-semibold px-2 py-1 rounded-lg mb-2 ${col.cls}`}>{col.label} ({counts[col.key] ?? 0})</div>
              <div className="space-y-2">
                {rows.filter((r) => r.status === col.key).map((r) => (
                  <Link key={r._id} href={`/quotations/${r._id}`} className="block bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-2 hover:shadow-sm">
                    <div className="font-mono text-[10px] text-[#8C6B1F] font-semibold">{r.quotationNo}</div>
                    <div className="text-xs font-medium mt-0.5 truncate">{r.customerName}</div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{r.licensePlate} · {r.vehicleBrand}</div>
                    <div className="text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300 mt-1">{formatMoney(r.totalSalePrice)}</div>
                    <div className="text-[9px] text-zinc-300 mt-0.5">{r.salesName}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead><tr className="text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60">
            {["เลขที่", "ลูกค้า", "รถ", "ราคาขาย", "ค่างวด/ด.", "สถานะ", "เซลล์", ""].map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>))}
          </tr></thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {loading ? Array.from({ length: 6 }).map((_, i) => (<tr key={`sk${i}`}>{Array.from({ length: 8 }).map((_, c) => (<td key={c} className="px-3 py-2"><Skeleton className="h-4" /></td>))}</tr>))
              : rows.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-zinc-300 text-xs">ยังไม่มีใบเสนอราคา — กด &quot;สร้างใบเสนอราคา&quot;</td></tr>
              : rows.map((r) => (
                <tr key={r._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-[#8C6B1F]"><Link href={`/quotations/${r._id}`} className="hover:underline">{r.quotationNo}</Link></td>
                  <td className="px-3 py-2">{r.customerName}<span className="text-zinc-400 dark:text-zinc-500 text-xs">{r.customerPhone ? ` · ${r.customerPhone}` : ""}</span></td>
                  <td className="px-3 py-2 text-xs">{r.licensePlate} <span className="text-zinc-400 dark:text-zinc-500">{r.vehicleBrand}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.totalSalePrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{formatMoney(r.monthlyPayment)}</td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stMeta(r.status).cls}`}>{stMeta(r.status).label}</span></td>
                  <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">{r.salesName}</td>
                  <td className="px-3 py-2">
                    <a href={`/api/quotations/${r._id}/pdf`} target="_blank" rel="noreferrer" className="text-[#C9A227] hover:underline text-xs inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> PDF
                    </a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      )}

      {formMode && (
        <QuoteForm mode={formMode} presetPlate={presetPlate} onClose={() => setFormMode(null)} onSaved={() => { setFormMode(null); load() }} />
      )}
    </div>
  )
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-400 dark:text-zinc-500">กำลังโหลด...</div>}>
      <QuotationsInner />
    </Suspense>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl px-4 py-3">
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 tabular-nums ${tone === "good" ? "text-emerald-600" : ""}`}>{value}</p>
    </div>
  )
}

function QuoteForm({ mode, presetPlate, onClose, onSaved }: { mode: "lead" | "quote"; presetPlate: string; onClose: () => void; onSaved: () => void }) {
  const isLead = mode === "lead"
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [plate, setPlate] = useState(presetPlate)
  const [plateQ, setPlateQ] = useState(presetPlate)
  const [plateOpen, setPlateOpen] = useState(false)
  const [custQ, setCustQ] = useState("")
  const [custList, setCustList] = useState<Customer[]>([])
  const [custId, setCustId] = useState("")
  const [custName, setCustName] = useState("")
  const [custPhone, setCustPhone] = useState("")
  const [salesName, setSalesName] = useState("")
  const { data: session } = useSession()
  useEffect(() => { if (session?.user?.name) setSalesName((s) => s || session.user!.name!) }, [session])
  const [snap, setSnap] = useState<Record<string, number>>({})
  const [cashDown, setCashDown] = useState(0)
  const [savingsUsed, setSavingsUsed] = useState(0)   // เงินสะสม พจส. (บันทึกไว้เฉย ๆ)
  const [extras, setExtras] = useState("")
  const [extrasAuto, setExtrasAuto] = useState(true)
  const [promoNote, setPromoNote] = useState("")
  const [note, setNote] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => { fetch("/api/price-list").then((r) => r.ok ? r.json() : []).then((d: PriceRow[]) => setPrices(d)) }, [])
  useEffect(() => {
    const row = prices.find((p) => p.licensePlate === plate)
    if (row) {
      setSnap({ totalSalePrice: row.totalSalePrice, downPayment: row.downPayment, cashDown: row.cashDown,
        downInstallmentCount: row.downInstallmentCount, financeAmount: row.financeAmount,
        financeInstallments: row.financeInstallments, monthlyPayment: row.monthlyPayment })
      setCashDown(row.cashDown)
    }
  }, [plate, prices])
  useEffect(() => {
    const t = setTimeout(() => fetch(`/api/customers?q=${encodeURIComponent(custQ)}`).then((r) => r.ok ? r.json() : []).then(setCustList), 250)
    return () => clearTimeout(t)
  }, [custQ])
  useEffect(() => {
    if (!plate) { setPromoNote(""); return }
    fetch(`/api/promotions/master?plate=${encodeURIComponent(plate)}`).then((r) => r.ok ? r.json() : null).then((d) => {
      setPromoNote(d?.found ? "ดึงจากโปรโมชั่นของรถคันนี้อัตโนมัติ" : "รถคันนี้ยังไม่ตั้งโปรโมชั่นใน /promotions")
      if (extrasAuto) setExtras(d?.summary ?? "")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plate])

  const sel = prices.find((p) => p.licensePlate === plate)
  // ดาวน์ต่องวด = (ดาวน์รวม − ดาวน์ชำระเลย) / จำนวนงวดดาวน์ (คำนวณอัตโนมัติ)
  const remainDown = Math.max(0, (snap.downPayment ?? 0) - cashDown)
  const downPerInstallment = snap.downInstallmentCount ? Math.round(remainDown / snap.downInstallmentCount) : 0
  // เลือกได้ทุกคัน — ไม่ติดเงื่อนไขสถานะสัญญา
  const plateMatches = prices.filter((p) => p.licensePlate.replace(/\s/g, "").includes(plateQ.replace(/\s/g, ""))).slice(0, 25)
  const fmtNum = (n: number) => (n ?? 0).toLocaleString("th-TH")

  async function submit() {
    if (!isLead && !plate) { setErr("เลือกรถก่อน"); return }
    if (!custName.trim() && !custId) { setErr("ระบุลูกค้า"); return }
    setSaving(true); setErr("")
    try {
      let cid = custId, cname = custName.trim(), cphone = custPhone.trim()
      if (!cid && cname) {
        const cr = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cname, phone: cphone }) })
        if (cr.ok) cid = (await cr.json())._id
      }
      const body = {
        status: isLead ? "lead" : "quoted",
        licensePlate: plate,
        vehicleBrand: sel?.vehicleBrand ?? "", vehicleModel: sel?.vehicleModel ?? "", truckNumber: sel?.truckNumber ?? "",
        vehiclePhotoUrl: sel?.photoUrl ?? "",
        vehiclePhotos: sel?.photos ?? undefined,
        customerId: cid, customerName: cname, customerPhone: cphone,
        salesName: salesName.trim(), savingsUsed,
        totalSalePrice: snap.totalSalePrice ?? 0, downPayment: snap.downPayment ?? 0, cashDown,
        downInstallmentCount: snap.downInstallmentCount ?? 0, downInstallmentAmt: downPerInstallment,
        financeAmount: snap.financeAmount ?? 0, financeInstallments: snap.financeInstallments ?? 0, monthlyPayment: snap.monthlyPayment ?? 0,
        extras, note, validUntil,
      }
      const r = await fetch("/api/quotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? "บันทึกไม่สำเร็จ"); return }
      if (!isLead) window.open(`/api/quotations/${d._id}/pdf`, "_blank")
      onSaved()
    } finally { setSaving(false) }
  }

  const ro = (label: string, value: string) => (
    <div className="flex justify-between text-sm py-1">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span><span className="font-medium tabular-nums">{value}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <h2 className="font-bold">{isLead ? "บันทึกลูกค้าสนใจ (Lead)" : "สร้างใบเสนอราคา"}</h2>
          <button onClick={onClose} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* เลือกรถ — auto search */}
          <div className="relative">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">เลือกรถพร้อมขาย {isLead && <span className="text-zinc-300">(ไม่บังคับ)</span>}</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input value={plateQ} onChange={(e) => { setPlateQ(e.target.value); setPlateOpen(true); setPlate("") }} onFocus={() => setPlateOpen(true)}
                placeholder="พิมพ์ทะเบียนเพื่อค้นหา" className="w-full h-10 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3" />
            </div>
            {plateOpen && plateQ && !plate && plateMatches.length > 0 && (
              <div className="absolute z-20 left-0 right-0 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg mt-1 max-h-52 overflow-y-auto shadow-lg">
                {plateMatches.map((p) => (
                  <button key={p.licensePlate} onClick={() => { setPlate(p.licensePlate); setPlateQ(p.licensePlate); setPlateOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex justify-between">
                    <span className="font-medium">{p.licensePlate}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs">{p.vehicleBrand} · {fmtNum(p.totalSalePrice)}</span>
                  </button>
                ))}
              </div>
            )}
            {sel && (
              <div className="flex items-center gap-3 mt-2">
                {sel.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sel.photoUrl} alt="รถ" className="w-16 h-12 object-cover rounded-md border border-zinc-200 dark:border-zinc-700" />
                )}
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{sel.vehicleBrand || "-"} {sel.vehicleModel || ""} · เบอร์รถ {sel.truckNumber || "-"}{!sel.photoUrl && " · (รถคันนี้ยังไม่มีรูป)"}</p>
              </div>
            )}
          </div>

          {/* ลูกค้า */}
          <div className="border-t pt-4">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">ลูกค้า</label>
            <input value={custName} onChange={(e) => { setCustName(e.target.value); setCustQ(e.target.value); setCustId("") }}
              placeholder="พิมพ์ชื่อลูกค้า (ใหม่/ค้นหาเดิม)" className="w-full h-10 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3" />
            {custQ && custList.length > 0 && !custId && (
              <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg mt-1 max-h-32 overflow-y-auto">
                {custList.map((c) => (
                  <button key={c._id} onClick={() => { setCustId(c._id); setCustName(c.name); setCustPhone(c.phone ?? ""); setCustQ("") }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">{c.name}<span className="text-zinc-400 dark:text-zinc-500 text-xs">{c.phone ? ` · ${c.phone}` : ""}</span></button>
                ))}
              </div>
            )}
            <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="เบอร์โทร" className="w-full h-10 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 mt-2" />
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 mt-3">พนักงานขาย (เซล)</label>
            <select value={salesName} onChange={(e) => setSalesName(e.target.value)} className="w-full h-10 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 bg-white dark:bg-zinc-900">
              {salesName && !SALES_PEOPLE.includes(salesName as (typeof SALES_PEOPLE)[number]) && <option value={salesName}>{salesName} (ผู้ล็อกอิน)</option>}
              {SALES_PEOPLE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {custId && <p className="text-[11px] text-emerald-600 mt-1">✓ ลูกค้าเดิมในระบบ</p>}
          </div>

          {/* ราคา — แก้ได้แค่ดาวน์ชำระเลย ที่เหลือ read-only + คำนวณดาวน์/งวด */}
          {sel && (
            <div className="border-t pt-4">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">ราคา</label>
              {ro("ราคาขายรวม", `${fmtNum(snap.totalSalePrice)} บาท`)}
              {ro("เงินดาวน์รวม", `${fmtNum(snap.downPayment)} บาท`)}
              <div className="flex items-center justify-between py-1.5 bg-amber-50/60 rounded-lg px-2 my-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-300">ดาวน์ชำระเลย <span className="text-[10px] text-amber-600">(แก้ได้)</span></span>
                <input type="number" value={cashDown} onChange={(e) => setCashDown(Number(e.target.value) || 0)}
                  className="w-32 h-8 text-sm border border-amber-300 rounded-lg px-2 text-right tabular-nums bg-white dark:bg-zinc-900" />
              </div>
              {ro(`ดาวน์คงเหลือ (ผ่อน ${snap.downInstallmentCount || 0} งวด)`, `${fmtNum(remainDown)} บาท`)}
              <div className="flex justify-between text-sm py-1 font-semibold text-[#8C6B1F]">
                <span>→ ดาวน์/งวด (คำนวณ)</span><span className="tabular-nums">{fmtNum(downPerInstallment)} บาท</span>
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
              {ro("ยอดจัดไฟแนนซ์", `${fmtNum(snap.financeAmount)} บาท`)}
              {ro("ค่างวด/เดือน", `${fmtNum(snap.monthlyPayment)} × ${snap.financeInstallments || 0} งวด`)}
              <div className="flex items-center justify-between py-1.5 bg-sky-50/60 dark:bg-sky-950/20 rounded-lg px-2 my-1">
                <span className="text-sm text-zinc-600 dark:text-zinc-300">ใช้เงินสะสม พจส. <span className="text-[10px] text-sky-600">(บันทึกไว้ ไม่หักยอด)</span></span>
                <input type="number" value={savingsUsed} onChange={(e) => setSavingsUsed(Number(e.target.value) || 0)}
                  className="w-32 h-8 text-sm border border-sky-300 rounded-lg px-2 text-right tabular-nums bg-white dark:bg-zinc-900" />
              </div>
            </div>
          )}

          {/* ของแถม/โปรโมชั่น */}
          {sel && (
          <div className="border-t pt-4 space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">ของแถม / โปรโมชั่น</label>
                {plate && !extrasAuto && (
                  <button type="button" onClick={() => { setExtrasAuto(true); fetch(`/api/promotions/master?plate=${encodeURIComponent(plate)}`).then((r) => r.ok ? r.json() : null).then((d) => setExtras(d?.summary ?? "")) }}
                    className="text-[10px] text-[#C9A227] hover:underline">↺ ดึงโปรฯ ของรถอีกครั้ง</button>
                )}
              </div>
              <textarea value={extras} onChange={(e) => { setExtras(e.target.value); setExtrasAuto(false) }} rows={3}
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2" placeholder="เลือกรถแล้วระบบจะดึงโปรโมชั่นให้อัตโนมัติ (แก้เพิ่มได้)" />
              {promoNote && <p className={`text-[10px] mt-0.5 ${extrasAuto ? "text-emerald-600" : "text-zinc-400 dark:text-zinc-500"}`}>{extrasAuto ? "✓ " : ""}{promoNote}</p>}
            </div>
          </div>
          )}

          <div className="border-t pt-4 space-y-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">{isLead ? "โน้ต / ความสนใจ" : "หมายเหตุ"}</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-9 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3" />
            </div>
            {!isLead && (
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">ยืนราคาถึง</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-9 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-2" />
              </div>
            )}
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-zinc-500 dark:text-zinc-400 px-4 py-2">ยกเลิก</button>
          <button onClick={submit} disabled={saving} className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : isLead ? "บันทึกลูกค้าสนใจ" : "สร้าง + เปิด PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}
