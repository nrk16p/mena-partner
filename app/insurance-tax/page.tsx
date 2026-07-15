"use client"

/**
 * ภาษี & ประกันภัย — ติดตามรอบต่อภาษี/ประกันภัยรถต่อทะเบียน
 * - list รวมทุกทะเบียน + สถานะรอบปัจจุบัน (ใช้งาน/ใกล้หมด/หมดแล้ว/ยังไม่มีข้อมูล)
 * - ต่ออายุ = POST รอบใหม่ (backend ปิดรอบเก่าเป็น renewed ให้อัตโนมัติ)
 * - ประวัติทุกรอบต่อทะเบียนดูได้จาก drawer (GET ?plate=)
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ShieldCheck, Search, Download, Clock, X, RefreshCw, Pencil, Upload,
  FileText, Trash2, PlusCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePagination, PaginationBar } from "@/components/pagination"
import { ThaiDateInput, displayThaiDate } from "@/components/thai-date-input"
import { formatMoney } from "@/lib/utils"

// ────────────────────────── types (ตาม API /api/insurance-tax) ──────────────────────────
type Attachment = { name: string; url: string }

interface Cycle {
  _id: string
  licensePlate: string
  platePlain?: string
  effectiveDate?: string
  expiryDate?: string
  insuranceCompany?: string
  insurer?: string
  insuranceAmount?: number
  prbAmount?: number
  taxAmount?: number
  inspectionCost?: number
  totalCost?: number
  installmentCount?: number
  monthlyInstallment?: number
  collectStart?: string
  collectEnd?: string
  status?: string
  attachments?: Attachment[]
  notes?: string
  migratedFrom?: string
  createdAt?: string
  updatedAt?: string
}

type DisplayStatus = "active" | "expiring" | "expired" | "renewed" | "none"

interface Row {
  licensePlate: string
  platePlain?: string
  truckNumber?: string
  brand?: string
  model?: string
  driverName?: string
  contractCode?: string
  current: Cycle | null
  displayStatus: DisplayStatus
  cyclesCount: number
}

interface Counts { total: number; active: number; expiring: number; expired: number; none: number }

// ────────────────────────── labels / colors ──────────────────────────
const STATUS_LABEL: Record<DisplayStatus, string> = {
  active: "ใช้งาน", expiring: "ใกล้หมดอายุ", expired: "หมดอายุ", renewed: "ต่ออายุแล้ว", none: "ยังไม่มีข้อมูล",
}
const STATUS_COLOR: Record<DisplayStatus, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  expiring: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  expired:  "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  renewed:  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  none:     "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "",         label: "ทั้งหมด" },
  { key: "active",   label: "ใช้งาน" },
  { key: "expiring", label: "ใกล้หมด" },
  { key: "expired",  label: "หมดแล้ว" },
  { key: "none",     label: "ยังไม่มีข้อมูล" },
]

// ────────────────────────── helpers ──────────────────────────
const num = (s: string): number | undefined => {
  if (s.trim() === "") return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
const fmt = (n?: number | null) => (n || n === 0 ? formatMoney(n) : null)

/** "YYYY-MM-DD" +1 ปี (คงวัน-เดือนเดิม) */
function plusOneYear(iso?: string): string {
  const m = /^(\d{4})-(\d{2}-\d{2})/.exec(iso || "")
  return m ? `${Number(m[1]) + 1}-${m[2]}` : ""
}
/** "YYYY-MM" +1 ปี */
function plusOneYearMonth(ym?: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym || "")
  return m ? `${Number(m[1]) + 1}-${m[2]}` : ""
}
/** "YYYY-MM" → "ม.ค. 2569" */
function displayThaiMonth(ym?: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym || "")
  if (!m) return "—"
  const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`
}

// ────────────────────────── ฟอร์มต่ออายุ / แก้ไขรอบ ──────────────────────────
interface FormState {
  effectiveDate: string
  expiryDate: string
  insuranceCompany: string
  insurer: string
  insuranceAmount: string
  prbAmount: string
  taxAmount: string
  inspectionCost: string
  installmentCount: string
  monthlyInstallment: string
  collectStart: string
  collectEnd: string
  notes: string
  attachments: Attachment[]
}

const EMPTY_FORM: FormState = {
  effectiveDate: "", expiryDate: "", insuranceCompany: "", insurer: "",
  insuranceAmount: "", prbAmount: "", taxAmount: "", inspectionCost: "",
  installmentCount: "", monthlyInstallment: "", collectStart: "", collectEnd: "",
  notes: "", attachments: [],
}

/** เตรียมค่าจากรอบเดิม — โหมดต่ออายุเลื่อนวันที่ +1 ปี (เริ่ม = วันหมดเดิม) */
function formFromCycle(c: Cycle, mode: "renew" | "edit"): FormState {
  const s = (v?: number) => (v || v === 0 ? String(v) : "")
  if (mode === "edit") return {
    effectiveDate: c.effectiveDate?.slice(0, 10) ?? "",
    expiryDate:    c.expiryDate?.slice(0, 10) ?? "",
    insuranceCompany: c.insuranceCompany ?? "",
    insurer:          c.insurer ?? "",
    insuranceAmount: s(c.insuranceAmount), prbAmount: s(c.prbAmount),
    taxAmount: s(c.taxAmount), inspectionCost: s(c.inspectionCost),
    installmentCount: s(c.installmentCount), monthlyInstallment: s(c.monthlyInstallment),
    collectStart: c.collectStart ?? "", collectEnd: c.collectEnd ?? "",
    notes: c.notes ?? "", attachments: c.attachments ?? [],
  }
  return {
    ...EMPTY_FORM,
    effectiveDate: c.expiryDate?.slice(0, 10) ?? "",
    expiryDate:    plusOneYear(c.expiryDate),
    insuranceCompany: c.insuranceCompany ?? "",
    insurer:          c.insurer ?? "",
    insuranceAmount: s(c.insuranceAmount), prbAmount: s(c.prbAmount),
    taxAmount: s(c.taxAmount), inspectionCost: s(c.inspectionCost),
    installmentCount: s(c.installmentCount),
    collectStart: plusOneYearMonth(c.collectStart), collectEnd: plusOneYearMonth(c.collectEnd),
  }
}

function CyclePanel({ row, cycle, mode, onClose, onSaved }: {
  row: Row
  cycle: Cycle | null              // โหมด edit = รอบที่แก้ / โหมด renew = รอบเดิมไว้ prefill
  mode: "renew" | "edit"
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(() => (cycle ? formFromCycle(cycle, mode) : { ...EMPTY_FORM }))
  const [monthlyTouched, setMonthlyTouched] = useState(mode === "edit" && !!cycle?.monthlyInstallment)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const set = (k: keyof FormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }))

  const total = useMemo(
    () => [form.insuranceAmount, form.prbAmount, form.taxAmount, form.inspectionCost]
      .map((s) => num(s) ?? 0).reduce((a, b) => a + b, 0),
    [form.insuranceAmount, form.prbAmount, form.taxAmount, form.inspectionCost],
  )
  const count = num(form.installmentCount)
  const suggest = total > 0 && count && count > 0 ? Math.round((total / count) * 100) / 100 : null

  // auto-suggest หัก/เดือน = รวม/จำนวนงวด (จนกว่าผู้ใช้จะพิมพ์เอง)
  useEffect(() => {
    if (!monthlyTouched && suggest !== null) setForm((p) => ({ ...p, monthlyInstallment: String(suggest) }))
  }, [suggest, monthlyTouched])

  async function uploadFile(f: File) {
    setUploading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", f)
      fd.append("folder", "insurance")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ")
      const { url } = await res.json()
      setForm((p) => ({ ...p, attachments: [...p.attachments, { name: f.name, url }] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไฟล์ไม่สำเร็จ")
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    setSaving(true)
    setError("")
    try {
      const body = {
        licensePlate: row.licensePlate,
        effectiveDate: form.effectiveDate || undefined,
        expiryDate: form.expiryDate || undefined,
        insuranceCompany: form.insuranceCompany.trim() || undefined,
        insurer: form.insurer.trim() || undefined,
        insuranceAmount: num(form.insuranceAmount),
        prbAmount: num(form.prbAmount),
        taxAmount: num(form.taxAmount),
        inspectionCost: num(form.inspectionCost),
        totalCost: total > 0 ? total : undefined,
        installmentCount: num(form.installmentCount),
        monthlyInstallment: num(form.monthlyInstallment),
        collectStart: form.collectStart || undefined,
        collectEnd: form.collectEnd || undefined,
        notes: form.notes.trim() || undefined,
        attachments: form.attachments,
      }
      const res = mode === "edit" && cycle
        ? await fetch(`/api/insurance-tax/${cycle._id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          })
        : await fetch("/api/insurance-tax", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          })
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ กรุณาลองใหม่")
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setSaving(false)
    }
  }

  const label = "block text-[11px] font-semibold text-zinc-500 mb-1"
  const numberCls = "h-9 text-right tabular-nums"

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-md h-full bg-white dark:bg-zinc-900 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">
              {mode === "edit" ? <Pencil className="w-4 h-4 text-blue-500" /> : <RefreshCw className="w-4 h-4 text-emerald-500" />}
              {mode === "edit" ? "แก้ไขรอบปัจจุบัน" : cycle ? "ต่ออายุ (บันทึกรอบใหม่)" : "บันทึกรอบใหม่"}
            </div>
            <div className="text-xs text-zinc-400 font-mono">{row.licensePlate}{row.truckNumber ? ` · ${row.truckNumber}` : ""}</div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {mode === "renew" && cycle && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              ระบบดึงข้อมูลจากรอบเดิมและเลื่อนวันที่ให้ +1 ปี — บันทึกแล้วรอบเดิมจะถูกปิดเป็น &quot;ต่ออายุแล้ว&quot; อัตโนมัติ
            </p>
          )}

          {/* ทะเบียน */}
          <div>
            <label className={label}>ทะเบียนรถ</label>
            <Input value={row.licensePlate} readOnly disabled className="h-9 font-mono bg-zinc-50 dark:bg-zinc-800" />
          </div>

          {/* ช่วงคุ้มครอง */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>วันเริ่มคุ้มครอง</label>
              <ThaiDateInput value={form.effectiveDate} onChange={set("effectiveDate")} />
            </div>
            <div>
              <label className={label}>วันหมดอายุ</label>
              <ThaiDateInput value={form.expiryDate} onChange={set("expiryDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>บริษัทประกัน</label>
              <Input value={form.insuranceCompany} onChange={(e) => set("insuranceCompany")(e.target.value)} className="h-9" placeholder="เช่น วิริยะประกันภัย" />
            </div>
            <div>
              <label className={label}>ผู้ทำเรื่อง</label>
              <Input value={form.insurer} onChange={(e) => set("insurer")(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* ค่าใช้จ่าย */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">ค่าใช้จ่าย (บาท)</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["insuranceAmount", "ประกันภัย"],
                ["prbAmount", "พรบ."],
                ["taxAmount", "ภาษีทะเบียน"],
                ["inspectionCost", "ตรวจสภาพ"],
              ] as const).map(([k, l]) => (
                <div key={k}>
                  <label className={label}>{l}</label>
                  <Input
                    type="number" min={0} step="0.01" inputMode="decimal"
                    value={form[k]}
                    onChange={(e) => set(k)(e.target.value)}
                    className={numberCls}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-2.5">
              <span className="text-xs font-semibold text-zinc-500">รวมทั้งสิ้น</span>
              <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                ฿{formatMoney(total)}
              </span>
            </div>
          </div>

          {/* การหักเงิน */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>จำนวนงวด</label>
              <Input
                type="number" min={0} step={1} inputMode="numeric"
                value={form.installmentCount}
                onChange={(e) => set("installmentCount")(e.target.value)}
                className={numberCls}
              />
            </div>
            <div>
              <label className={label}>หัก/เดือน (บาท)</label>
              <Input
                type="number" min={0} step="0.01" inputMode="decimal"
                value={form.monthlyInstallment}
                onChange={(e) => { setMonthlyTouched(true); set("monthlyInstallment")(e.target.value) }}
                className={numberCls}
              />
              {suggest !== null && num(form.monthlyInstallment) !== suggest && (
                <button
                  type="button"
                  onClick={() => { setMonthlyTouched(true); set("monthlyInstallment")(String(suggest)) }}
                  className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  แนะนำ ฿{formatMoney(suggest)} (รวม ÷ {count} งวด)
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>เริ่มหัก (เดือน)</label>
              <Input type="month" value={form.collectStart} onChange={(e) => set("collectStart")(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className={label}>สิ้นสุดหัก (เดือน)</label>
              <Input type="month" value={form.collectEnd} onChange={(e) => set("collectEnd")(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* หมายเหตุ */}
          <div>
            <label className={label}>หมายเหตุ</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* ไฟล์แนบ */}
          <div>
            <label className={label}>ไฟล์แนบ (กรมธรรม์ / ใบเสร็จ)</label>
            <div className="space-y-1.5">
              {form.attachments.map((a, i) => (
                <div key={`${a.url}-${i}`} className="flex items-center gap-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-emerald-700 dark:text-emerald-400 hover:underline">
                    {a.name || "ไฟล์แนบ"}
                  </a>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, attachments: p.attachments.filter((_, j) => j !== i) }))}
                    className="text-zinc-300 hover:text-red-500 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <label className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed cursor-pointer transition-colors ${
                uploading
                  ? "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:border-blue-700"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
              }`}>
                {uploading
                  ? <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  : <Upload className="w-3 h-3" />}
                แนบไฟล์ (PDF/รูปภาพ)
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadFile(f)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* actions */}
          <div className="flex items-center gap-2 pt-1 pb-6">
            <Button
              onClick={handleSubmit}
              disabled={saving || uploading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
            >
              {saving ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : "บันทึกรอบใหม่"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────── drawer ประวัติทุกรอบของทะเบียน ──────────────────────────
function HistoryDrawer({ plate, isAdmin, onClose, onChanged }: {
  plate: string
  isAdmin: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [cycles, setCycles] = useState<Cycle[] | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/insurance-tax?plate=${encodeURIComponent(plate)}`)
      .then((r) => (r.ok ? r.json() : { cycles: [] }))
      .then((d) => setCycles(d.cycles ?? []))
      .catch(() => setCycles([]))
  }, [plate])

  useEffect(() => { setCycles(null); load() }, [load])

  async function handleDelete(c: Cycle) {
    if (!confirm(`ลบรอบ ${displayThaiDate(c.effectiveDate ?? "") || "?"} – ${displayThaiDate(c.expiryDate ?? "") || "?"} ของ ${plate}?`)) return
    setDeleting(c._id)
    try {
      const res = await fetch(`/api/insurance-tax/${c._id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("ลบไม่สำเร็จ")
      load()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-sm h-full bg-white dark:bg-zinc-900 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">
              <Clock className="w-4 h-4" /> ประวัติภาษี & ประกันภัย
            </div>
            <div className="text-xs text-zinc-400 font-mono">{plate}</div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {cycles === null ? (
            <p className="text-sm text-zinc-400 text-center py-8">กำลังโหลด...</p>
          ) : cycles.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">ยังไม่มีประวัติ</p>
          ) : cycles.map((c) => {
            const st = (["active", "expiring", "expired", "renewed", "none"].includes(c.status ?? "")
              ? c.status : "renewed") as DisplayStatus
            return (
              <div key={c._id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    {displayThaiDate(c.effectiveDate ?? "") || "—"} – {displayThaiDate(c.expiryDate ?? "") || "—"}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_COLOR[st]}`}>
                    {STATUS_LABEL[st] ?? c.status}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 space-y-0.5">
                  {c.insuranceCompany && <p>บริษัท: <span className="text-zinc-700 dark:text-zinc-300">{c.insuranceCompany}</span>{c.insurer && <span className="text-zinc-400"> · ผู้ทำเรื่อง {c.insurer}</span>}</p>}
                  {(c.totalCost || c.totalCost === 0) && (
                    <p>รวม: <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">฿{formatMoney(c.totalCost)}</span>
                      {c.monthlyInstallment ? <span className="text-zinc-400"> · หัก ฿{formatMoney(c.monthlyInstallment)}/เดือน{c.installmentCount ? ` ×${c.installmentCount}` : ""}</span> : null}
                    </p>
                  )}
                  {(c.collectStart || c.collectEnd) && (
                    <p>ช่วงหัก: {displayThaiMonth(c.collectStart)} – {displayThaiMonth(c.collectEnd)}</p>
                  )}
                  {c.notes && <p className="text-zinc-400">หมายเหตุ: {c.notes}</p>}
                </div>
                {(c.attachments?.length || c.migratedFrom) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {c.attachments?.map((a, i) => (
                      <a
                        key={`${a.url}-${i}`}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/60 max-w-[140px] truncate"
                      >
                        <FileText className="w-2.5 h-2.5 shrink-0" /> {a.name || "ไฟล์แนบ"}
                      </a>
                    ))}
                    {c.migratedFrom && (
                      <span className="inline-flex items-center text-[10px] text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded" title={`ย้ายข้อมูลมาจาก ${c.migratedFrom}`}>
                        migrated: {c.migratedFrom}
                      </span>
                    )}
                  </div>
                )}
                {isAdmin && (
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      disabled={deleting === c._id}
                      className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" /> {deleting === c._id ? "กำลังลบ..." : "ลบรอบนี้"}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────── หน้า list หลัก ──────────────────────────
function InsuranceTaxContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const isAdmin = session?.user?.role === "admin"

  const [items, setItems]   = useState<Row[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, active: 0, expiring: 0, expired: 0, none: 0 })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [statusFilter, setStatusFilter] = useState("")
  const [panel, setPanel] = useState<{ row: Row; cycle: Cycle | null; mode: "renew" | "edit" } | null>(null)
  const [historyPlate, setHistoryPlate] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/insurance-tax")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      if (data.counts) setCounts(data.counts)
    } catch {
      // backend ยังไม่พร้อม / ผิดพลาด → แสดง empty state
      setItems([])
      setCounts({ total: 0, active: 0, expiring: 0, expired: 0, none: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ค้นหา + กรองสถานะ (client-side)
  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return items.filter((r) => {
      if (statusFilter && r.displayStatus !== statusFilter) return false
      if (!kw) return true
      return [r.licensePlate, r.platePlain, r.truckNumber, r.driverName, r.current?.insuranceCompany, r.contractCode]
        .some((v) => v?.toLowerCase().includes(kw))
    })
  }, [items, q, statusFilter])

  const pg = usePagination(visible, 50, [q, statusFilter])

  function handleExportCSV() {
    if (!visible.length) return
    const headers = [
      "ทะเบียน","เบอร์รถ","คนขับ","บริษัทประกัน","ผู้ทำเรื่อง","วันเริ่ม","วันหมดอายุ",
      "ประกันภัย","พรบ.","ภาษีทะเบียน","ตรวจสภาพ","รวม","จำนวนงวด","หัก/เดือน","เริ่มหัก","สิ้นสุดหัก","สถานะ","จำนวนรอบ",
    ]
    const rows = visible.map((r) => {
      const c = r.current
      return [
        r.licensePlate, r.truckNumber ?? "", r.driverName ?? "",
        c?.insuranceCompany ?? "", c?.insurer ?? "",
        c?.effectiveDate?.slice(0, 10) ?? "", c?.expiryDate?.slice(0, 10) ?? "",
        c?.insuranceAmount ?? "", c?.prbAmount ?? "", c?.taxAmount ?? "", c?.inspectionCost ?? "",
        c?.totalCost ?? "", c?.installmentCount ?? "", c?.monthlyInstallment ?? "",
        c?.collectStart ?? "", c?.collectEnd ?? "",
        STATUS_LABEL[r.displayStatus] ?? r.displayStatus, r.cyclesCount,
      ].map((v) => (typeof v === "string" && v.includes(",")) ? `"${v}"` : v).join(",")
    })
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `insurance-tax-${statusFilter || "all"}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const KPI = [
    { key: "",         label: "ทั้งหมด",        value: counts.total,    dot: "bg-zinc-400",    accent: "text-zinc-900 dark:text-zinc-50" },
    { key: "active",   label: "ใช้งาน",          value: counts.active,   dot: "bg-emerald-500", accent: "text-emerald-700 dark:text-emerald-400" },
    { key: "expiring", label: "ใกล้หมดอายุ (≤60 วัน)", value: counts.expiring, dot: "bg-amber-500",   accent: "text-amber-700 dark:text-amber-400" },
    { key: "expired",  label: "หมดอายุ",         value: counts.expired,  dot: "bg-red-500",     accent: "text-red-700 dark:text-red-400" },
    { key: "none",     label: "ยังไม่มีข้อมูล",   value: counts.none,     dot: "bg-zinc-300 dark:bg-zinc-600", accent: "text-zinc-500 dark:text-zinc-400" },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            ภาษี &amp; ประกันภัย
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {visible.length} ทะเบียน
            {statusFilter === "" && counts.total > 0 && (
              <> · ใช้งาน <span className="text-emerald-600 font-medium">{counts.active}</span> / ใกล้หมด <span className="text-amber-600 font-medium">{counts.expiring}</span> / หมดแล้ว <span className="text-red-500 font-medium">{counts.expired}</span></>
            )}
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </div>

      {/* KPI chips — คลิกเพื่อกรอง */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {KPI.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setStatusFilter(statusFilter === k.key ? "" : k.key)}
            className={`text-left bg-white dark:bg-zinc-900 border rounded-xl px-4 py-3 transition-colors ${
              statusFilter === k.key
                ? "border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-400 dark:ring-emerald-600"
                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${k.dot}`} />
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider truncate">{k.label}</p>
            </div>
            <p className={`text-xl font-bold tabular-nums leading-none ${k.accent}`}>{k.value}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <Input
            placeholder="ค้นหา ทะเบียน / เบอร์รถ / คนขับ / บริษัทประกัน"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-[11px] text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">ทะเบียน</th>
                <th className="px-4 py-3 text-left font-semibold">เบอร์รถ</th>
                <th className="px-4 py-3 text-left font-semibold">คนขับ</th>
                <th className="px-4 py-3 text-left font-semibold">บริษัทประกัน</th>
                <th className="px-4 py-3 text-left font-semibold">วันเริ่ม</th>
                <th className="px-4 py-3 text-left font-semibold">วันหมดอายุ</th>
                <th className="px-4 py-3 text-right font-semibold">ค่าใช้จ่ายรวม</th>
                <th className="px-4 py-3 text-right font-semibold">หัก/เดือน</th>
                <th className="px-4 py-3 text-center font-semibold">สถานะ</th>
                <th className="px-4 py-3 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-zinc-400">ไม่พบข้อมูล</td></tr>
              ) : pg.paged.map((r) => {
                const c = r.current
                return (
                  <tr key={r.licensePlate} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {r.licensePlate}
                      </span>
                      {(r.brand || r.model) && (
                        <div className="text-[10px] text-zinc-400 mt-0.5">{[r.brand, r.model].filter(Boolean).join(" · ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{r.truckNumber || <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{r.driverName || <span className="text-zinc-300 dark:text-zinc-600">—</span>}</td>
                    <td className="px-4 py-3 text-xs">
                      {c?.insuranceCompany
                        ? <span className="text-zinc-700 dark:text-zinc-300">{c.insuranceCompany}</span>
                        : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {c?.effectiveDate ? displayThaiDate(c.effectiveDate) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {c?.expiryDate ? (
                        <span className={
                          r.displayStatus === "expired" ? "text-red-500 font-semibold"
                          : r.displayStatus === "expiring" ? "text-amber-600 dark:text-amber-400 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400"
                        }>
                          {displayThaiDate(c.expiryDate)}
                        </span>
                      ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(c?.totalCost)
                        ? <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fmt(c?.totalCost)}</span>
                        : <span className="text-zinc-300 dark:text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      {c?.monthlyInstallment ? (
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {formatMoney(c.monthlyInstallment)}
                          {c.installmentCount ? <span className="text-zinc-400"> ×{c.installmentCount}</span> : null}
                        </span>
                      ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${STATUS_COLOR[r.displayStatus]}`}>
                        {STATUS_LABEL[r.displayStatus] ?? r.displayStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {isAdmin && (
                          <button
                            type="button"
                            title={c ? "ต่ออายุ (บันทึกรอบใหม่)" : "บันทึกรอบใหม่"}
                            onClick={() => setPanel({ row: r, cycle: c, mode: "renew" })}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/60 whitespace-nowrap"
                          >
                            {c ? <RefreshCw className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                            {c ? "ต่ออายุ" : "เพิ่มข้อมูล"}
                          </button>
                        )}
                        {isAdmin && c && (
                          <button
                            type="button"
                            title="แก้ไขรอบปัจจุบัน"
                            onClick={() => setPanel({ row: r, cycle: c, mode: "edit" })}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {r.cyclesCount > 0 && (
                          <button
                            type="button"
                            title={`ประวัติ ${r.cyclesCount} รอบ`}
                            onClick={() => setHistoryPlate(r.licensePlate)}
                            className="inline-flex items-center gap-0.5 text-[10px] w-auto px-1.5 h-6 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <Clock className="w-3.5 h-3.5" />{r.cyclesCount > 1 ? r.cyclesCount : null}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <PaginationBar {...pg} unit="ทะเบียน" />
      </div>

      {/* slide-over ฟอร์มต่ออายุ / แก้ไข */}
      {panel && (
        <CyclePanel
          row={panel.row}
          cycle={panel.cycle}
          mode={panel.mode}
          onClose={() => setPanel(null)}
          onSaved={() => { setPanel(null); load() }}
        />
      )}

      {/* drawer ประวัติ */}
      {historyPlate && (
        <HistoryDrawer
          plate={historyPlate}
          isAdmin={isAdmin}
          onClose={() => setHistoryPlate(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

export default function InsuranceTaxPage() {
  // useSearchParams ต้องอยู่ใต้ Suspense boundary ตามข้อกำหนด App Router
  return (
    <Suspense fallback={<div className="px-4 py-10 text-center text-sm text-zinc-400">กำลังโหลด...</div>}>
      <InsuranceTaxContent />
    </Suspense>
  )
}
