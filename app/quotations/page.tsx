"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FileText, Plus, Search, X, ExternalLink } from "lucide-react"
import { formatMoney } from "@/lib/utils"

type Status = "lead" | "quoted" | "booked" | "won" | "lost"
const STATUS: { key: Status; label: string; cls: string }[] = [
  { key: "lead",   label: "สนใจ",         cls: "bg-zinc-100 text-zinc-600" },
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
  totalSalePrice: number; downPayment: number; cashDown: number; remainingInstallment: number
  downInstallmentCount: number; downInstallmentAmt: number
  financeAmount: number; financeInstallments: number; monthlyPayment: number
}
interface Customer { _id: string; name: string; phone?: string }

export default function QuotationsPage() {
  const sp = useSearchParams()
  const [rows, setRows] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | "">("")
  const [q, setQ] = useState("")
  const [showForm, setShowForm] = useState(false)

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
  useEffect(() => { if (presetPlate) setShowForm(true) }, [presetPlate])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1 })
    return c
  }, [rows])

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">ระบบขาย</p>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-[#C9A227]" /> ใบเสนอราคา & ดีลขาย</h1>
          <p className="text-xs text-zinc-400 mt-0.5">คนขายเลือกรถพร้อมขาย → ออกใบเสนอราคา → ติดตามดีล (ทั้งทีมเห็นทุกดีล)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
          <Plus className="w-4 h-4" /> สร้างใบเสนอราคา
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เลขที่/ลูกค้า/ทะเบียน/เซลล์"
            className="h-8 w-64 text-sm pl-8 pr-3 rounded-full border border-zinc-200 bg-white" />
        </div>
        <span className="w-px h-5 bg-zinc-200 mx-1" />
        <button onClick={() => setFilter("")} className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === "" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>ทั้งหมด ({rows.length})</button>
        {STATUS.map((s) => (
          <button key={s.key} onClick={() => setFilter(filter === s.key ? "" : s.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${filter === s.key ? "bg-zinc-900 text-white" : s.cls}`}>
            {s.label} ({counts[s.key] ?? 0})
          </button>
        ))}
      </div>

      <div className="bg-white border border-zinc-100 rounded-xl overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead><tr className="text-zinc-400 border-b border-zinc-100 bg-zinc-50/60">
            {["เลขที่", "ลูกค้า", "รถ", "ราคาขาย", "ค่างวด/ด.", "สถานะ", "เซลล์", ""].map((h) => (
              <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>))}
          </tr></thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? <tr><td colSpan={8} className="text-center py-8 text-zinc-400 text-xs">กำลังโหลด...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-zinc-300 text-xs">ยังไม่มีใบเสนอราคา — กด &quot;สร้างใบเสนอราคา&quot;</td></tr>
              : rows.map((r) => (
                <tr key={r._id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-[#8C6B1F]">{r.quotationNo}</td>
                  <td className="px-3 py-2">{r.customerName}<span className="text-zinc-400 text-xs">{r.customerPhone ? ` · ${r.customerPhone}` : ""}</span></td>
                  <td className="px-3 py-2 text-xs">{r.licensePlate} <span className="text-zinc-400">{r.vehicleBrand}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.totalSalePrice)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{formatMoney(r.monthlyPayment)}</td>
                  <td className="px-3 py-2"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stMeta(r.status).cls}`}>{stMeta(r.status).label}</span></td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{r.salesName}</td>
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

      {showForm && (
        <QuoteForm presetPlate={presetPlate} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function QuoteForm({ presetPlate, onClose, onSaved }: { presetPlate: string; onClose: () => void; onSaved: () => void }) {
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [plate, setPlate] = useState(presetPlate)
  const [custQ, setCustQ] = useState("")
  const [custList, setCustList] = useState<Customer[]>([])
  const [custId, setCustId] = useState("")
  const [custName, setCustName] = useState("")
  const [custPhone, setCustPhone] = useState("")
  const [f, setF] = useState<Record<string, number>>({})
  const [extras, setExtras] = useState("")
  const [note, setNote] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    fetch("/api/price-list").then((r) => r.ok ? r.json() : []).then((d: PriceRow[]) => setPrices(d))
  }, [])
  // เลือกรถ → เติมราคา snapshot
  useEffect(() => {
    const row = prices.find((p) => p.licensePlate === plate)
    if (row) setF({
      totalSalePrice: row.totalSalePrice, downPayment: row.downPayment, cashDown: row.cashDown,
      downInstallmentCount: row.downInstallmentCount, downInstallmentAmt: row.downInstallmentAmt,
      financeAmount: row.financeAmount, financeInstallments: row.financeInstallments, monthlyPayment: row.monthlyPayment,
    })
  }, [plate, prices])
  useEffect(() => {
    const t = setTimeout(() => fetch(`/api/customers?q=${encodeURIComponent(custQ)}`).then((r) => r.ok ? r.json() : []).then(setCustList), 250)
    return () => clearTimeout(t)
  }, [custQ])

  const sel = prices.find((p) => p.licensePlate === plate)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: Number(v) || 0 }))
  const FIELDS: [string, string][] = [
    ["totalSalePrice", "ราคาขายรวม"], ["downPayment", "เงินดาวน์รวม"], ["cashDown", "ดาวน์ชำระเลย"],
    ["downInstallmentCount", "งวดดาวน์"], ["downInstallmentAmt", "ดาวน์/งวด"],
    ["financeAmount", "ยอดไฟแนนซ์"], ["financeInstallments", "งวดไฟแนนซ์"], ["monthlyPayment", "ค่างวด/เดือน"],
  ]

  async function submit() {
    if (!plate) { setErr("เลือกรถก่อน"); return }
    if (!custName.trim() && !custId) { setErr("ระบุลูกค้า"); return }
    setSaving(true); setErr("")
    try {
      let cid = custId, cname = custName.trim(), cphone = custPhone.trim()
      if (!cid && cname) {
        const cr = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cname, phone: cphone }) })
        if (cr.ok) { const c = await cr.json(); cid = c._id }
      }
      const body = {
        licensePlate: plate, vehicleBrand: (sel as unknown as { vehicleBrand?: string })?.vehicleBrand,
        customerId: cid, customerName: cname, customerPhone: cphone,
        ...f, extras, note, validUntil,
      }
      const r = await fetch("/api/quotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? "บันทึกไม่สำเร็จ"); return }
      window.open(`/api/quotations/${d._id}/pdf`, "_blank")
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white">
          <h2 className="font-bold">สร้างใบเสนอราคา</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">เลือกรถพร้อมขาย</label>
            <select value={plate} onChange={(e) => setPlate(e.target.value)} className="w-full h-10 text-sm border border-zinc-200 rounded-lg px-2 bg-white">
              <option value="">— เลือกทะเบียน —</option>
              {prices.filter((p) => p.status !== "contract").map((p) => (
                <option key={p.licensePlate} value={p.licensePlate}>{p.licensePlate} · {formatMoney(p.totalSalePrice)} บ.</option>
              ))}
            </select>
          </div>

          <div className="border-t pt-4">
            <label className="block text-xs font-medium text-zinc-500 mb-1">ลูกค้า</label>
            <input value={custName} onChange={(e) => { setCustName(e.target.value); setCustQ(e.target.value); setCustId("") }}
              placeholder="พิมพ์ชื่อลูกค้า (ใหม่/ค้นหาเดิม)" className="w-full h-10 text-sm border border-zinc-200 rounded-lg px-3" />
            {custQ && custList.length > 0 && !custId && (
              <div className="border border-zinc-100 rounded-lg mt-1 max-h-32 overflow-y-auto">
                {custList.map((c) => (
                  <button key={c._id} onClick={() => { setCustId(c._id); setCustName(c.name); setCustPhone(c.phone ?? ""); setCustQ("") }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50">{c.name}<span className="text-zinc-400 text-xs">{c.phone ? ` · ${c.phone}` : ""}</span></button>
                ))}
              </div>
            )}
            <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="เบอร์โทร" className="w-full h-10 text-sm border border-zinc-200 rounded-lg px-3 mt-2" />
            {custId && <p className="text-[11px] text-emerald-600 mt-1">✓ ลูกค้าเดิมในระบบ</p>}
          </div>

          {plate && (
            <div className="border-t pt-4">
              <label className="block text-xs font-medium text-zinc-500 mb-2">ราคา (แก้ได้ก่อนออกใบเสนอ)</label>
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map(([k, lbl]) => (
                  <div key={k}>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">{lbl}</label>
                    <input type="number" value={f[k] ?? 0} onChange={(e) => set(k, e.target.value)}
                      className="w-full h-9 text-sm border border-zinc-200 rounded-lg px-2 text-right tabular-nums" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">ของแถม / โปรโมชั่น</label>
              <textarea value={extras} onChange={(e) => setExtras(e.target.value)} rows={2} className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">หมายเหตุ</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-9 text-sm border border-zinc-200 rounded-lg px-3" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">ยืนราคาถึง</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-9 text-sm border border-zinc-200 rounded-lg px-2" />
            </div>
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-zinc-500 px-4 py-2">ยกเลิก</button>
          <button onClick={submit} disabled={saving} className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
            {saving ? "กำลังสร้าง..." : "สร้าง + เปิด PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}
