"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText, Upload, CheckCircle2, ChevronRight } from "lucide-react"
import { formatMoney } from "@/lib/utils"

type Status = "lead" | "quoted" | "booked" | "won" | "lost"
const FLOW: Status[] = ["lead", "quoted", "booked", "won"]
const META: Record<Status, { label: string; cls: string }> = {
  lead: { label: "สนใจ", cls: "bg-zinc-100 text-zinc-600" },
  quoted: { label: "เสนอราคาแล้ว", cls: "bg-amber-100 text-amber-700" },
  booked: { label: "วางจอง", cls: "bg-sky-100 text-sky-700" },
  won: { label: "ปิดการขาย", cls: "bg-emerald-100 text-emerald-700" },
  lost: { label: "ยกเลิก", cls: "bg-red-100 text-red-600" },
}

interface Quote {
  _id: string; quotationNo: string; status: Status
  customerName: string; customerPhone?: string
  licensePlate: string; vehicleBrand?: string; vehicleModel?: string; truckNumber?: string
  totalSalePrice: number; downPayment: number; cashDown: number
  downInstallmentCount: number; downInstallmentAmt: number
  financeAmount: number; financeInstallments: number; monthlyPayment: number
  extras?: string; note?: string; validUntil?: string
  depositAmount?: number; depositSlipUrl?: string; depositSlips?: string[]; depositPaidAt?: string
  salesName: string; salesEmail: string; createdAt: string
  timeline?: { at: string; by: string; action: string; note?: string }[]
}

export default function DealPage() {
  const { id } = useParams<{ id: string }>()
  const [q, setQ] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [depAmt, setDepAmt] = useState("")
  const [noteText, setNoteText] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch(`/api/quotations/${id}`).then((r) => r.ok ? r.json() : null).then((d) => { if (d?._id) { setQ(d); setDepAmt(d.depositAmount ? String(d.depositAmount) : "") } })
  }, [id])
  useEffect(load, [load])

  async function patch(body: Record<string, unknown>, ok?: string) {
    setBusy(true); setErr("")
    try {
      const r = await fetch(`/api/quotations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? "ทำรายการไม่สำเร็จ"); return }
      setQ(d); if (ok) setNoteText("")
    } finally { setBusy(false) }
  }

  function allSlips(): string[] {
    const arr = [...(q?.depositSlips ?? [])]
    if (q?.depositSlipUrl && !arr.includes(q.depositSlipUrl)) arr.unshift(q.depositSlipUrl)
    return arr
  }
  async function uploadSlip(file: File) {
    const cur = allSlips()
    if (cur.length >= 10) { setErr("แนบสลิปได้สูงสุด 10 ใบ"); return }
    setBusy(true); setErr("")
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "quotations")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) { setErr("อัปโหลดสลิปไม่สำเร็จ"); return }
      const { url } = await res.json()
      await patch({ depositSlips: [...cur, url] })
    } finally { setBusy(false) }
  }
  async function removeSlip(url: string) {
    await patch({ depositSlips: allSlips().filter((u) => u !== url), ...(q?.depositSlipUrl === url ? { depositSlipUrl: "" } : {}) })
  }

  if (!q) return <div className="p-8 text-sm text-zinc-400">กำลังโหลด...</div>
  const stepIdx = FLOW.indexOf(q.status)

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/quotations" className="text-zinc-400 hover:text-zinc-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[#8C6B1F]">{q.quotationNo}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${META[q.status].cls}`}>{META[q.status].label}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">{q.customerName}{q.customerPhone ? ` · ${q.customerPhone}` : ""} · โดย {q.salesName}</p>
        </div>
        <a href={`/api/quotations/${q._id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-2 gold-grad text-[#031B14] text-sm font-semibold px-4 py-2 rounded-lg">
          <FileText className="w-4 h-4" /> ใบเสนอ PDF
        </a>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-1">
        {FLOW.map((st, i) => (
          <div key={st} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />}
            <span className={`px-2.5 py-1 rounded-full border ${i <= stepIdx && q.status !== "lost" ? META[st].cls + " font-semibold border-transparent" : "bg-white text-zinc-300 border-zinc-100"}`}>
              {i < stepIdx ? "✓ " : ""}{META[st].label}
            </span>
          </div>
        ))}
        {q.status === "lost" && <span className="ml-2 text-red-500 font-semibold">· ยกเลิกแล้ว</span>}
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{err}</div>}

      {/* Pipeline actions */}
      <div className="flex flex-wrap items-center gap-2">
        {q.status !== "won" && q.status !== "lost" && stepIdx < FLOW.length - 1 && (
          <button onClick={() => patch({ status: FLOW[stepIdx + 1] })} disabled={busy}
            className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" /> เลื่อนเป็น &quot;{META[FLOW[stepIdx + 1]].label}&quot;
          </button>
        )}
        {q.status === "won" && (
          <>
            <Link href={`/contracts/new?plate=${encodeURIComponent(q.licensePlate)}`}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              สร้างสัญญาจากดีลนี้ →
            </Link>
            <Link href="/drivers"
              className="flex items-center gap-2 border border-blue-300 text-blue-700 hover:bg-blue-50 text-sm font-semibold px-4 py-2 rounded-lg">
              สร้างข้อมูลคนขับ →
            </Link>
          </>
        )}
        {q.status !== "lost" && q.status !== "won" && (
          <button onClick={() => { const n = window.prompt("เหตุผลที่ยกเลิกดีล:"); if (n) patch({ status: "lost", note: n }) }} disabled={busy}
            className="text-sm text-red-500 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg">ยกเลิกดีล</button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* รถ + ราคา */}
        <Section title="รถ & ราคา">
          <div className="text-sm space-y-1">
            <Row k="รถ" v={`${q.licensePlate} · ${q.vehicleBrand ?? "-"} ${q.vehicleModel ?? ""}`} />
            <Row k="เบอร์รถ" v={q.truckNumber ?? "-"} />
            <div className="border-t border-zinc-100 my-2" />
            <Row k="ราคาขายรวม" v={formatMoney(q.totalSalePrice)} bold />
            <Row k="เงินดาวน์รวม" v={formatMoney(q.downPayment)} />
            <Row k="ยอดจัดไฟแนนซ์" v={formatMoney(q.financeAmount)} />
            <Row k="ค่างวด/เดือน" v={`${formatMoney(q.monthlyPayment)} × ${q.financeInstallments} งวด`} />
          </div>
          {q.extras && <p className="text-xs text-zinc-500 mt-3 pt-2 border-t border-zinc-100">🎁 {q.extras}</p>}
        </Section>

        {/* เงินจอง */}
        <Section title="เงินจอง & หลักฐาน">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">ยอดเงินจอง (บาท)</label>
              <input type="number" value={depAmt} onChange={(e) => setDepAmt(e.target.value)}
                className="w-full h-9 text-sm border border-zinc-200 rounded-lg px-3 text-right tabular-nums" />
            </div>
            <button onClick={() => patch({ depositAmount: Number(depAmt) || 0, depositPaidAt: new Date().toISOString().slice(0, 10), ...(Number(depAmt) > 0 && (q.status === "lead" || q.status === "quoted") ? { status: "booked" } : {}) })}
              disabled={busy} className="h-9 bg-emerald-600 text-white text-sm font-semibold px-4 rounded-lg disabled:opacity-50">บันทึก</button>
          </div>
          {q.depositAmount ? (
            <p className="text-xs text-emerald-700 mt-2">✓ วางจอง {formatMoney(q.depositAmount)} บาท{q.depositPaidAt ? ` เมื่อ ${q.depositPaidAt}` : ""}</p>
          ) : <p className="text-xs text-zinc-400 mt-2">ยังไม่มีเงินจอง</p>}

          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSlip(f); e.target.value = "" }} />
          <div className="mt-3">
            <button onClick={() => fileRef.current?.click()} disabled={busy || allSlips().length >= 10}
              className="flex items-center gap-2 text-sm border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Upload className="w-3.5 h-3.5" /> แนบสลิป ({allSlips().length}/10)
            </button>
            {allSlips().length > 0 && (
              <ul className="mt-2 space-y-1">
                {allSlips().map((u, i) => (
                  <li key={u} className="flex items-center gap-2 text-xs">
                    <a href={u} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex-1 truncate">สลิปที่ {i + 1}</a>
                    <button onClick={() => removeSlip(u)} disabled={busy} className="text-zinc-300 hover:text-red-500">ลบ</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>

      {/* Timeline + note */}
      <Section title="กิจกรรม / บันทึกการติดตาม">
        <div className="flex gap-2 mb-3">
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="บันทึกการโทร/นัด/ต่อรอง..."
            className="flex-1 h-9 text-sm border border-zinc-200 rounded-lg px-3" onKeyDown={(e) => { if (e.key === "Enter" && noteText.trim()) patch({ note: noteText.trim() }, "note") }} />
          <button onClick={() => noteText.trim() && patch({ note: noteText.trim() }, "note")} disabled={busy || !noteText.trim()}
            className="h-9 bg-zinc-900 text-white text-sm px-4 rounded-lg disabled:opacity-50">เพิ่ม</button>
        </div>
        <ul className="space-y-2">
          {[...(q.timeline ?? [])].reverse().map((t, i) => (
            <li key={i} className="text-xs flex gap-2">
              <span className="text-zinc-300 shrink-0 w-28">{new Date(t.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span>
              <span className="text-zinc-600">{t.action}{t.note ? ` — ${t.note}` : ""} <span className="text-zinc-300">· {t.by}</span></span>
            </li>
          ))}
          {(q.timeline ?? []).length === 0 && <li className="text-xs text-zinc-300">ยังไม่มีกิจกรรม</li>}
        </ul>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  )
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{k}</span>
      <span className={bold ? "font-bold text-[#8C6B1F]" : "text-zinc-700"}>{v}</span>
    </div>
  )
}
