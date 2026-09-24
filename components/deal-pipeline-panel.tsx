"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, PauseCircle, PlayCircle, XCircle, Upload, AlertTriangle } from "lucide-react"
import { PHASES, STAGE_LABEL, STATUS_LABEL, type Stage } from "@/lib/deal-stage"

/**
 * แผงไปป์ไลน์บนหน้าดีล — stepper 10 ขั้น + ข้อมูลบังคับของขั้นปัจจุบัน + ปุ่มขยับ/พัก/ปิดดีล
 * กติกาทั้งหมดถามจาก API (/api/quotations/[id]/stage) ฝั่งนี้แค่แสดงและส่งคำสั่ง — server ตรวจซ้ำเสมอ
 */

interface StageInfo {
  stage: string
  advance: { ok: boolean; to: Stage | null; missing: string[]; error?: string }
  screening: { key: string; label: string; pass: boolean; auto: boolean; detail?: string }[]
  lossReasons: { _id?: string; code: string; label: string; group: string }[]
}

export interface DealForPanel {
  _id: string
  stage?: string
  stageBeforeHold?: string
  holdReason?: string
  nextFollowUpDate?: string
  lossReasonLabel?: string
  lossNote?: string
  lostAtStage?: string
  screening?: Record<string, unknown>
  quotationSentAt?: string
  viewingDate?: string
  reservationAmount?: number
  depositAmount?: number
  trainingStartDate?: string
  trainingResult?: string
  contractDate?: string
  deliveryDate?: string
  deliveredAt?: string
  attachments?: { type: string; url: string; label?: string; uploadedAt?: string }[]
}

const ATTACH_LABEL: Record<string, string> = {
  QUOTATION: "ใบเสนอราคา",
  RESERVATION_SLIP: "หลักฐานโอนเงินจอง",
  SIGNED_CONTRACT: "สัญญาที่ลงนามแล้ว",
  DELIVERY_PHOTO: "รูปลูกค้าคู่กับรถตอนส่งมอบ",
}

/** ข้อมูล + ไฟล์ที่ต้องกรอกในแต่ละขั้น (ตรงกับกติกาใน lib/deal-stage) */
const STAGE_FORM: Record<string, { fields: { key: string; label: string; type: "date" | "number" | "select" }[]; attach?: string }> = {
  QUALIFIED: { fields: [{ key: "quotationSentAt", label: "วันที่ส่งใบเสนอราคา", type: "date" }], attach: "QUOTATION" },
  QUOTED: { fields: [{ key: "viewingDate", label: "วันนัดดูรถ", type: "date" }] },
  VIEWING_SCHEDULED: { fields: [{ key: "reservationAmount", label: "จำนวนเงินจอง (บาท)", type: "number" }], attach: "RESERVATION_SLIP" },
  RESERVED: { fields: [{ key: "trainingStartDate", label: "วันเริ่มฝึกงาน", type: "date" }] },
  TRAINING: { fields: [
    { key: "trainingResult", label: "ผลฝึกงาน", type: "select" },
    { key: "contractDate", label: "วันนัดเซ็นสัญญา", type: "date" },
  ] },
  CONTRACT_SCHEDULED: { fields: [{ key: "deliveryDate", label: "วันนัดรับรถ", type: "date" }], attach: "SIGNED_CONTRACT" },
  CONTRACT_SIGNED: { fields: [{ key: "deliveredAt", label: "วันที่ส่งมอบจริง", type: "date" }], attach: "DELIVERY_PHOTO" },
}

export function DealPipelinePanel({ deal, onChanged }: { deal: DealForPanel; onChanged: () => void }) {
  const id = deal._id
  const [info, setInfo] = useState<StageInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [dialog, setDialog] = useState<"" | "hold" | "close">("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [attachType, setAttachType] = useState("")

  const load = useCallback(() => {
    // โหลดสถานะ/กติกาจาก server เสมอ (ไม่คำนวณเองฝั่ง client จะได้ไม่มีสองความจริง)
    let alive = true
    fetch(`/api/quotations/${id}/stage`)
      .then((r) => (r.ok ? r.json() : null))
      // โหลดข้อมูลจาก API ตอน mount — ไม่ใช่ cascading render (กฎนี้จับ setState ในเอฟเฟกต์แบบซิงโครนัส)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      .then((d) => { if (alive) setInfo(d) })
    return () => { alive = false }
  }, [id])
  useEffect(() => load(), [load])

  async function act(body: Record<string, unknown>) {
    setBusy(true); setErr("")
    try {
      const res = await fetch(`/api/quotations/${id}/stage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.error ?? "ทำรายการไม่ได้"); return false }
      setDialog(""); load(); onChanged()
      return true
    } finally { setBusy(false) }
  }

  async function upload(file: File) {
    if (!attachType) return
    setBusy(true); setErr("")
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "quotations")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) { setErr("อัปโหลดไฟล์ไม่สำเร็จ"); return }
      const { url } = await res.json()
      await act({ action: "attach", type: attachType, url, label: ATTACH_LABEL[attachType] })
    } finally { setBusy(false); setAttachType("") }
  }

  if (!info) return <div className="text-sm text-zinc-400">กำลังโหลดสถานะ…</div>

  const stage = info.stage
  const onHold = stage === "ON_HOLD"
  const closed = stage === "CLOSED_LOST"
  const activeStage = onHold ? String(deal.stageBeforeHold ?? "LEAD") : stage
  const form = STAGE_FORM[activeStage]
  const files = deal.attachments ?? []

  const stageInput = "h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"

  return (
    <div className="space-y-4">
      {/* stepper 10 ขั้น จัดกลุ่มตามด่าน */}
      <div className="flex items-start gap-3 overflow-x-auto pb-1">
        {PHASES.map((p) => (
          <div key={p.no} className="shrink-0">
            <div className="text-[10px] text-zinc-400 mb-1">{p.no}. {p.label}</div>
            <div className="flex items-center gap-1">
              {p.stages.map((st) => {
                const idx = PHASES.flatMap((x) => x.stages).indexOf(st)
                const cur = PHASES.flatMap((x) => x.stages).indexOf(activeStage as Stage)
                const done = idx < cur, here = st === activeStage
                return (
                  <span key={st} className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap ${
                    here ? "bg-emerald-600 text-white border-transparent font-semibold"
                    : done ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-100 dark:border-zinc-800"}`}>
                    {done ? "✓ " : ""}{STAGE_LABEL[st]}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {onHold && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300">พักติดตามอยู่ (ขั้นเดิม: {STAGE_LABEL[activeStage as Stage]})</p>
          <p className="text-amber-700 dark:text-amber-200 mt-0.5">{deal.holdReason} · ติดตามอีกที {deal.nextFollowUpDate}</p>
        </div>
      )}
      {closed && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm">
          <p className="font-semibold">ปิดดีล – ไม่สำเร็จ ที่ขั้น {STATUS_LABEL[(deal.lostAtStage ?? "LEAD") as Stage]}</p>
          <p className="text-zinc-600 dark:text-zinc-300 mt-0.5">{deal.lossReasonLabel}{deal.lossNote ? ` · ${deal.lossNote}` : ""}</p>
        </div>
      )}

      {/* เช็กลิสต์คัดกรอง — เฉพาะขั้นผู้สนใจ */}
      {activeStage === "LEAD" && !closed && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-sm font-semibold mb-2">เช็กลิสต์คัดกรอง (ต้องผ่านครบก่อนไปขั้นถัดไป)</p>
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            <label className="text-xs">วันเกิด
              <input type="date" className={stageInput} defaultValue={String(deal.screening?.birthDate ?? "")}
                onBlur={(e) => act({ action: "fields", fields: { screening: { birthDate: e.target.value } } })} />
            </label>
            <label className="text-xs">วันออกใบขับขี่
              <input type="date" className={stageInput} defaultValue={String(deal.screening?.licenseIssueDate ?? "")}
                onBlur={(e) => act({ action: "fields", fields: { screening: { licenseIssueDate: e.target.value } } })} />
            </label>
            <label className="text-xs">ชนิดใบขับขี่
              <select className={stageInput} defaultValue={String(deal.screening?.licenseType ?? "")}
                onChange={(e) => act({ action: "fields", fields: { screening: { licenseType: e.target.value } } })}>
                <option value="">— เลือก —</option>
                {["ท.1", "ท.2", "ท.3", "ท.4"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <ul className="space-y-1.5">
            {info.screening.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-sm">
                {c.auto ? (
                  <span className={`mt-0.5 w-4 h-4 rounded-full shrink-0 ${c.pass ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"}`} />
                ) : (
                  <input type="checkbox" checked={c.pass} disabled={busy}
                    onChange={(e) => act({ action: "fields", fields: { screening: { [c.key]: e.target.checked } } })}
                    className="mt-1 w-4 h-4 shrink-0" />
                )}
                <span className={c.pass ? "" : "text-zinc-500"}>
                  {c.label}
                  {c.detail && <span className="text-xs text-zinc-400"> — {c.detail}</span>}
                  {c.auto && <span className="text-[10px] text-zinc-400"> (คำนวณจากวันที่)</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ข้อมูล/ไฟล์ของขั้นปัจจุบัน */}
      {form && !closed && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <p className="text-sm font-semibold">ข้อมูลที่ต้องมีก่อนขยับขั้น</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {form.fields.map((f) => (
              <label key={f.key} className="text-xs">{f.label}
                {f.type === "select" ? (
                  <select className={stageInput} defaultValue={String(deal.trainingResult ?? "")}
                    onChange={(e) => act({ action: "fields", fields: { trainingResult: e.target.value } })}>
                    <option value="">— ยังไม่สรุป —</option>
                    <option value="PASSED">ผ่าน</option>
                    <option value="FAILED">ไม่ผ่าน</option>
                  </select>
                ) : (
                  <input type={f.type} className={stageInput}
                    defaultValue={String((deal as unknown as Record<string, unknown>)[f.key] ?? (f.key === "reservationAmount" ? deal.depositAmount ?? "" : ""))}
                    onBlur={(e) => act({ action: "fields", fields: { [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value } })} />
                )}
              </label>
            ))}
          </div>

          {form.attach && (
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">{ATTACH_LABEL[form.attach]}</p>
              <div className="flex flex-wrap items-center gap-2">
                {files.filter((f) => f.type === form.attach).map((f) => (
                  <a key={f.url} href={f.url} target="_blank" rel="noreferrer"
                    className="text-xs text-emerald-700 underline underline-offset-2">ไฟล์ที่แนบ</a>
                ))}
                <button type="button" disabled={busy}
                  onClick={() => { setAttachType(form.attach!); fileRef.current?.click() }}
                  className="inline-flex items-center gap-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5">
                  <Upload className="w-3.5 h-3.5" /> แนบไฟล์
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* สิ่งที่ยังขาด */}
      {!closed && info.advance.missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> ยังขยับขั้นไม่ได้
          </p>
          <ul className="mt-1 text-sm text-amber-700 dark:text-amber-200 list-disc list-inside">
            {info.advance.missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{err}</div>}

      {/* ปุ่มสั่งงาน */}
      <div className="flex flex-wrap gap-2">
        {!closed && !onHold && info.advance.to && (
          <button onClick={() => act({ action: "advance" })} disabled={busy || !info.advance.ok}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40">
            <CheckCircle2 className="w-4 h-4" /> ขยับเป็น &quot;{STAGE_LABEL[info.advance.to]}&quot;
          </button>
        )}
        {onHold && (
          <button onClick={() => act({ action: "resume" })} disabled={busy}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            <PlayCircle className="w-4 h-4" /> กลับมาดำเนินการต่อ
          </button>
        )}
        {!closed && !onHold && (
          <button onClick={() => setDialog("hold")} disabled={busy}
            className="inline-flex items-center gap-2 border border-amber-300 text-amber-700 text-sm font-semibold px-4 py-2 rounded-lg">
            <PauseCircle className="w-4 h-4" /> พักติดตาม
          </button>
        )}
        {!closed && (
          <button onClick={() => setDialog("close")} disabled={busy}
            className="inline-flex items-center gap-2 border border-zinc-300 text-zinc-600 dark:text-zinc-300 text-sm font-semibold px-4 py-2 rounded-lg">
            <XCircle className="w-4 h-4" /> Pass on (ปิด–ไม่สำเร็จ)
          </button>
        )}
      </div>

      {dialog === "hold" && <HoldDialog busy={busy} onClose={() => setDialog("")} onSubmit={(holdReason, nextFollowUpDate) => act({ action: "hold", holdReason, nextFollowUpDate })} />}
      {dialog === "close" && <CloseDialog busy={busy} reasons={info.lossReasons} onClose={() => setDialog("")} onSubmit={(lossReasonId, lossNote) => act({ action: "close", lossReasonId, lossNote })} />}

      <input ref={fileRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }} />
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </div>
  )
}

function HoldDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (reason: string, date: string) => void }) {
  const [reason, setReason] = useState("")
  const [date, setDate] = useState("")
  const input = "h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
  return (
    <Modal title="พักติดตามดีล" onClose={onClose}>
      <label className="text-xs block">เหตุผลที่พัก
        <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ลูกค้าขอคิดดูก่อน" />
      </label>
      <label className="text-xs block">วันติดตามครั้งถัดไป
        <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="text-sm px-3 py-1.5">ยกเลิก</button>
        <button disabled={busy || !reason.trim() || !date} onClick={() => onSubmit(reason, date)}
          className="bg-amber-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40">พักติดตาม</button>
      </div>
    </Modal>
  )
}

function CloseDialog({ busy, reasons, onClose, onSubmit }: {
  busy: boolean
  reasons: { _id?: string; code: string; label: string }[]
  onClose: () => void
  onSubmit: (reasonId: string, note: string) => void
}) {
  const [reasonId, setReasonId] = useState("")
  const [note, setNote] = useState("")
  const input = "h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
  return (
    <Modal title="ปิดดีล – ไม่สำเร็จ" onClose={onClose}>
      <p className="text-xs text-zinc-500">เลือกเหตุผลที่ดีลหลุด (เห็นเฉพาะเหตุผลของขั้นที่ดีลอยู่)</p>
      <select className={input} value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
        <option value="">— เลือกเหตุผล —</option>
        {reasons.map((r) => <option key={r._id ?? r.code} value={String(r._id ?? r.code)}>{r.label}</option>)}
      </select>
      <label className="text-xs block">หมายเหตุเพิ่มเติม (ไม่บังคับ)
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="text-sm px-3 py-1.5">ยกเลิก</button>
        <button disabled={busy || !reasonId} onClick={() => onSubmit(reasonId, note)}
          className="bg-zinc-800 text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40">ปิดดีล</button>
      </div>
    </Modal>
  )
}
