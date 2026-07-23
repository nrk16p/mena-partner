"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { Search, Plus, X, Check, User, ChevronRight, Download, Upload, FileText, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { usePagination, PaginationBar } from "@/components/pagination"
import { Button } from "@/components/ui/button"
import type { Driver } from "@/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (isNaN(b.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age
}

function formatThaiDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
}

const AVATAR_BG = [
  "bg-emerald-500", "bg-blue-500", "bg-violet-500",
  "bg-amber-500",   "bg-rose-500",  "bg-cyan-500",
  "bg-indigo-500",  "bg-teal-500",
]
function avatarColor(name: string) {
  const code = (name ?? " ").charCodeAt(0)
  return AVATAR_BG[code % AVATAR_BG.length]
}

// ─── Slide panel ─────────────────────────────────────────────────────────────

interface FormData {
  firstName:    string
  lastName:     string
  birthDate:    string
  nationalId:   string
  address:      string
  staffCode:     string
  contractCode:  string
  phone:         string
  bankName:      string
  accountNumber: string
  isTruckOwner: boolean
  isDriver:     boolean
  startDate:    string
  endDate:      string
  status:       string
  idCardUrl:       string
  licenseUrl:      string
  houseRegUrl:     string
  bankBookUrl:     string
  tax50BisUrl:     string
  licenseNumber:   string
  licenseType:     string
  licenseExpiry:   string
}

const EMPTY_FORM: FormData = {
  firstName: "", lastName: "", birthDate: "",
  nationalId: "", address: "", staffCode: "", contractCode: "", phone: "",
  bankName: "", accountNumber: "",
  isTruckOwner: false, isDriver: true,
  startDate: "", endDate: "", status: "active",
  idCardUrl: "", licenseUrl: "", houseRegUrl: "", bankBookUrl: "", tax50BisUrl: "",
  licenseNumber: "", licenseType: "", licenseExpiry: "",
}

interface SlidePanelProps {
  driver:  Driver | null
  onClose: () => void
  onSaved: () => void
}

function SlidePanel({ driver, onClose, onSaved }: SlidePanelProps) {
  const isEdit = !!driver
  const [form, setForm]           = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  useEffect(() => {
    if (driver) {
      setForm({
        firstName:    driver.firstName    ?? "",
        lastName:     driver.lastName     ?? "",
        birthDate:    driver.birthDate    ?? "",
        nationalId:   driver.nationalId   ?? "",
        address:      driver.address      ?? "",
        staffCode:    driver.staffCode    ?? "",
        contractCode: driver.contractCode ?? "",
        phone:         driver.phone         ?? "",
        bankName:      driver.bankName      ?? "",
        accountNumber: driver.accountNumber ?? "",
        idCardUrl:      driver.idCardUrl     ?? "",
        licenseUrl:     driver.licenseUrl    ?? "",
        houseRegUrl:    driver.houseRegUrl   ?? "",
        bankBookUrl:    driver.bankBookUrl   ?? "",
        tax50BisUrl:    driver.tax50BisUrl   ?? "",
        licenseNumber:  driver.licenseNumber ?? "",
        licenseType:    driver.licenseType   ?? "",
        licenseExpiry:  driver.licenseExpiry ?? "",
        isTruckOwner: driver.isTruckOwner ?? false,
        isDriver:     driver.isDriver     ?? true,
        startDate:    driver.startDate    ?? "",
        endDate:      driver.endDate      ?? "",
        status:       driver.status       ?? "active",
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setError("")
  }, [driver])

  function set<K extends keyof FormData>(field: K, val: FormData[K]) {
    setForm((p) => ({ ...p, [field]: val }))
  }

  async function uploadDoc(field: "idCardUrl" | "licenseUrl" | "houseRegUrl" | "bankBookUrl" | "tax50BisUrl", file: File) {
    setUploadingDoc(field); setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "drivers")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      set(field, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploadingDoc(null)
    }
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("กรุณากรอกชื่อและนามสกุล"); return
    }
    setSaving(true); setError("")
    try {
      const url    = isEdit ? `/api/drivers/${driver!._id}` : "/api/drivers"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? "เกิดข้อผิดพลาด"); return
      }
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  const Div = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">พนักงานขับรถ</p>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {isEdit ? "แก้ไขข้อมูล" : "เพิ่มพนักงานใหม่"}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-3 pb-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0 ${avatarColor(form.firstName || " ")}`}>
              {form.firstName ? form.firstName[0].toUpperCase() : <User className="w-4 h-4 opacity-60" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {form.firstName || "ชื่อ"} {form.lastName || "นามสกุล"}
              </p>
              {form.staffCode && <p className="text-xs text-zinc-400 font-mono">{form.staffCode}</p>}
            </div>
          </div>

          <Div label="ข้อมูลส่วนตัว" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">ชื่อ <span className="text-red-400">*</span></label>
              <Input placeholder="ชื่อ" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">นามสกุล <span className="text-red-400">*</span></label>
              <Input placeholder="นามสกุล" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">วันเดือนปีเกิด</label>
            <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} className="h-9 text-sm" />
            {form.birthDate && <p className="text-[10px] text-zinc-400 mt-0.5">อายุ {calcAge(form.birthDate)} ปี</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">เลขบัตรประชาชน</label>
            <Input
              placeholder="0 0000 00000 00 0"
              value={form.nationalId}
              onChange={(e) => set("nationalId", e.target.value.replace(/\D/g, "").slice(0, 13))}
              className="h-9 text-sm font-mono tracking-widest"
              maxLength={13}
            />
            <p className="text-[10px] text-zinc-400 mt-0.5">{form.nationalId.length}/13 หลัก</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">ที่อยู่</label>
            <textarea
              placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 placeholder:text-zinc-300"
            />
          </div>

          <Div label="ข้อมูลการทำงาน" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">รหัสพนักงาน</label>
              <Input placeholder="EMP-001" value={form.staffCode} onChange={(e) => set("staffCode", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">รหัสสัญญา</label>
              <Input placeholder="MTM145 (ซ้ำกับคนอื่นได้)" value={form.contractCode} onChange={(e) => set("contractCode", e.target.value)} className="h-9 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">เบอร์โทรศัพท์</label>
              <Input placeholder="081-234-5678" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">ธนาคาร</label>
              <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className="h-9 text-sm" placeholder="กสิกรไทย / กรุงไทย..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">เลขที่บัญชี</label>
              <Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} className="h-9 text-sm font-mono" />
            </div>
          </div>

          {/* Document uploads */}
          <Div label="เอกสาร" />
          <div className="space-y-2">
            {([
              { field: "idCardUrl",   label: "บัตรประชาชน" },
              { field: "licenseUrl",  label: "ใบขับขี่" },
              { field: "houseRegUrl", label: "ทะเบียนบ้าน" },
              { field: "bankBookUrl", label: "หน้าบุ๊คแบงค์" },
              { field: "tax50BisUrl", label: "50 ทวิ" },
            ] as { field: "idCardUrl" | "licenseUrl" | "houseRegUrl" | "bankBookUrl" | "tax50BisUrl"; label: string }[]).map(({ field, label }) => {
              const url  = form[field]
              const busy = uploadingDoc === field
              return (
                <div key={field} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 w-24 shrink-0">{label}</span>
                  {url ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <a href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:underline truncate">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">ดูไฟล์</span>
                      </a>
                      <button type="button" onClick={() => set(field, "")}
                        className="text-zinc-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors
                      ${busy
                        ? "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400"
                        : "border-zinc-200 text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:hover:border-emerald-600"
                      }`}>
                      {busy ? (
                        <><div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /><span>กำลังอัปโหลด...</span></>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /><span>แนบไฟล์</span></>
                      )}
                      <input type="file" accept="image/*,.pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(field, f); e.target.value = "" }}
                        disabled={!!uploadingDoc} />
                    </label>
                  )}
                </div>
              )
            })}
          </div>

          <Div label="ใบขับขี่" />
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">เลขบัตรใบขับขี่</label>
              <Input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className="h-9 text-sm font-mono" placeholder="12345678" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">ประเภทใบขับขี่</label>
                <select
                  value={form.licenseType}
                  onChange={(e) => set("licenseType", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700"
                >
                  <option value="">— เลือกประเภท —</option>
                  <option value="ท.1">ท.1 รถยนต์ส่วนบุคคล</option>
                  <option value="ท.2">ท.2 รถยนต์สาธารณะ</option>
                  <option value="ท.3">ท.3 รถยนต์ขนส่ง</option>
                  <option value="ท.4">ท.4 รถยนต์บรรทุกส่วนบุคคล</option>
                  <option value="ท.5">ท.5 รถยนต์สามล้อ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">วันหมดอายุ</label>
                <Input type="date" value={form.licenseExpiry} onChange={(e) => set("licenseExpiry", e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">เริ่มงานวันที่</label>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">สิ้นสุดวันที่</label>
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isDriver} onChange={(e) => set("isDriver", e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">พนักงานขับรถ</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isTruckOwner} onChange={(e) => set("isTruckOwner", e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">เจ้าของรถ</span>
            </label>
          </div>

          <Div label="สถานะ" />
          <div className="flex gap-2">
            {[
              { value: "active",   label: "ใช้งาน",    cls: "bg-emerald-600 text-white" },
              { value: "inactive", label: "ไม่ใช้งาน", cls: "bg-zinc-500 text-white" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("status", opt.value)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  form.status === opt.value
                    ? opt.cls + " border-transparent"
                    : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0 flex gap-2">
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm" onClick={handleSave} disabled={saving}>
            {saving ? "กำลังบันทึก..." : <><Check className="w-3.5 h-3.5 mr-1.5" />{isEdit ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}</>}
          </Button>
          <Button variant="outline" className="h-9 text-sm" onClick={onClose}>ยกเลิก</Button>
        </div>
      </aside>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ upserted: number; skipped: number } | null>(null)
  const [error, setError]     = useState("")

  async function handleImport() {
    if (!file) return
    setLoading(true); setError(""); setResult(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/drivers/import", { method: "POST", body: fd })
      const j   = await res.json()
      if (!res.ok) { setError(j.error ?? "เกิดข้อผิดพลาด"); return }
      setResult({ upserted: j.upserted, skipped: j.skipped })
      onDone()
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">นำเข้าข้อมูลพนักงาน</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            อัปโหลดไฟล์ Excel ที่ได้จากการ Export เพื่ออัปเดตหรือเพิ่มข้อมูล
            <br />หากมี <span className="font-semibold">รหัสพนักงาน</span> จะทำการอัปเดตข้อมูลที่มีอยู่
          </p>

          <label className="block cursor-pointer">
            <div className={`border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors ${
              file ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
            }`}>
              <Upload className="w-6 h-6 mx-auto mb-1 text-zinc-300" />
              <p className="text-xs text-zinc-500">
                {file ? file.name : "คลิกเพื่อเลือกไฟล์ .xlsx"}
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
            />
          </label>

          {result && (
            <div className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-lg">
              นำเข้าสำเร็จ {result.upserted} แถว
              {result.skipped > 0 && ` · ข้าม ${result.skipped} แถว (ไม่มีชื่อ)`}
            </div>
          )}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm"
              onClick={handleImport}
              disabled={!file || loading}
            >
              {loading ? "กำลังนำเข้า..." : "นำเข้า"}
            </Button>
            <Button variant="outline" className="h-9 text-sm" onClick={onClose}>ปิด</Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = "" | "active" | "inactive"

const COLS = [
  { key: "name",      label: "ชื่อ - นามสกุล",  w: "w-48" },
  { key: "staffCode", label: "รหัสพนักงาน",      w: "w-24" },
  { key: "contractCode", label: "รหัสสัญญา",       w: "w-28" },
  { key: "age",       label: "อายุ",             w: "w-16" },
  { key: "phone",     label: "โทรศัพท์",         w: "w-32" },
  { key: "startDate", label: "เริ่มงาน",         w: "w-28" },
  { key: "role",      label: "บทบาท",            w: "w-28" },
  { key: "status",    label: "สถานะ",            w: "w-24" },
]

export default function DriversPage() {
  const [items, setItems]               = useState<Driver[]>([])
  const [q, setQ]                       = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [loading, setLoading]           = useState(true)
  const [panelDriver, setPanelDriver]   = useState<Driver | null | "new">(null)
  const [showImport, setShowImport]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/drivers?${params}`)
      if (res.ok) setItems(await res.json())
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!q) return items
    const lq = q.toLowerCase()
    return items.filter((d) =>
      `${d.firstName} ${d.lastName}`.toLowerCase().includes(lq) ||
      (d.nationalId ?? "").includes(q) ||
      (d.staffCode    ?? "").toLowerCase().includes(lq) ||
      (d.contractCode ?? "").toLowerCase().includes(lq) ||
      (d.phone      ?? "").includes(q) ||
      (d.address    ?? "").toLowerCase().includes(lq)
    )
  }, [items, q])

  const pg = usePagination(filtered, 50, [q, statusFilter])

  const activeCount   = items.filter((d) => d.status === "active").length
  const inactiveCount = items.filter((d) => d.status !== "active").length
  const showPanel     = panelDriver !== null
  const editDriver    = panelDriver === "new" ? null : panelDriver

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">ข้อมูลบุคลากร</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">พนักงานขับรถ</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{activeCount} ใช้งาน · {inactiveCount} ไม่ใช้งาน</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 text-sm gap-1.5"
            onClick={() => window.open("/api/drivers/export", "_blank")}
          >
            <Download className="w-3.5 h-3.5" />Export
          </Button>
          <Button
            variant="outline"
            className="h-9 text-sm gap-1.5"
            onClick={() => setShowImport(true)}
          >
            <Upload className="w-3.5 h-3.5" />Import
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm gap-1.5"
            onClick={() => setPanelDriver("new")}
          >
            <Plus className="w-4 h-4" />เพิ่มพนักงาน
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: "",         label: `ทั้งหมด (${items.length})` },
          { key: "active",   label: `ใช้งาน (${activeCount})` },
          { key: "inactive", label: `ไม่ใช้งาน (${inactiveCount})` },
        ] as { key: StatusFilter; label: string }[]).map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === f.key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="ค้นหาชื่อ / รหัส / เบอร์ / เลขบัตร..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 w-72 text-xs pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                {COLS.map((col) => (
                  <th key={col.key} className={`px-3 py-2.5 text-left font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap ${col.w}`}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-zinc-400 animate-pulse">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 1} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-300">
                      <User className="w-8 h-8" />
                      <p className="text-sm text-zinc-400">ไม่พบพนักงาน</p>
                      {q && (
                        <button className="text-xs text-zinc-400 underline" onClick={() => setQ("")}>
                          ล้างการค้นหา
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pg.paged.map((d) => {
                  const fullName = `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim()
                  const initial  = (d.firstName ?? "?")[0]?.toUpperCase() ?? "?"
                  const age      = calcAge(d.birthDate)
                  const roles    = [d.isDriver && "คนขับ", d.isTruckOwner && "เจ้าของรถ"].filter(Boolean)

                  return (
                    <tr key={d._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                      {/* Name */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${avatarColor(d.firstName ?? "")}`}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">{fullName || "—"}</p>
                            {d.nationalId && (
                              <p className="text-[10px] text-zinc-400 font-mono tracking-wider truncate">
                                {d.nationalId.replace(/(\d)(\d{4})(\d{5})(\d{2})(\d)/, "$1-$2-$3-$4-$5")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Staff code */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-zinc-500">{d.staffCode || "—"}</span>
                      </td>

                      {/* Contract code (ซ้ำกันได้) */}
                      <td className="px-3 py-2.5">
                        {d.contractCode
                          ? <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{d.contractCode}</span>
                          : <span className="text-zinc-300">—</span>}
                      </td>

                      {/* Age */}
                      <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {age !== null ? `${age} ปี` : "—"}
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">
                        {d.phone || "—"}
                      </td>

                      {/* Start date */}
                      <td className="px-3 py-2.5 tabular-nums text-zinc-500">
                        {formatThaiDateShort(d.startDate)}
                      </td>

                      {/* Role badges */}
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 flex-wrap">
                          {roles.length === 0 && <span className="text-zinc-300">—</span>}
                          {d.isDriver     && <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium text-[10px]">คนขับ</span>}
                          {d.isTruckOwner && <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-medium text-[10px]">เจ้าของรถ</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          d.status === "active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                          {d.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setPanelDriver(d)}
                            className="px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                          >
                            แก้ไข
                          </button>
                          <Link
                            href={`/drivers/${d._id}`}
                            className="p-1 text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <PaginationBar {...pg} unit="คน" note={q ? `(ค้นหาจากทั้งหมด ${items.length} คน)` : undefined} />
        )}
      </div>

      {showPanel && (
        <SlidePanel
          driver={editDriver}
          onClose={() => setPanelDriver(null)}
          onSaved={load}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
