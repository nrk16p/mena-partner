"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, Pencil, Trash2, User, Upload, FileText, ExternalLink, Check, X, Phone, Landmark, AlertTriangle, CheckCircle2, Truck, IdCard } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Contract, Driver } from "@/types"

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

function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
}

const AVATAR_BG = [
  "bg-emerald-500","bg-blue-500","bg-violet-500",
  "bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-teal-500",
]
function avatarColor(name: string) {
  const code = (name ?? " ").charCodeAt(0)
  return AVATAR_BG[code % AVATAR_BG.length]
}

// ─── Edit form (full-screen overlay) ─────────────────────────────────────────

interface EditFormProps {
  driver:    Driver
  onSaved:   (updated: Driver) => void
  onCancel:  () => void
  onDeleted: () => void
}

function EditForm({ driver, onSaved, onCancel, onDeleted }: EditFormProps) {
  const [form, setForm] = useState({
    firstName:     driver.firstName     ?? "",
    lastName:      driver.lastName      ?? "",
    birthDate:     driver.birthDate     ?? "",
    nationalId:    driver.nationalId    ?? "",
    address:       driver.address       ?? "",
    staffCode:     driver.staffCode     ?? "",
    phone:         driver.phone         ?? "",
    bankName:      driver.bankName      ?? "",
    accountNumber: driver.accountNumber ?? "",
    idCardUrl:     driver.idCardUrl     ?? "",
    licenseUrl:    driver.licenseUrl    ?? "",
    houseRegUrl:   driver.houseRegUrl   ?? "",
    licenseNumber: driver.licenseNumber ?? "",
    licenseType:   driver.licenseType   ?? "",
    licenseExpiry: driver.licenseExpiry ?? "",
    isTruckOwner:  driver.isTruckOwner  ?? false,
    isDriver:      driver.isDriver      ?? true,
    startDate:     driver.startDate     ?? "",
    endDate:       driver.endDate       ?? "",
    status:        driver.status        ?? "active",
  })
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [error,        setError]        = useState("")
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  async function uploadDoc(field: "idCardUrl" | "licenseUrl" | "houseRegUrl", file: File) {
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
      const res = await fetch(`/api/drivers/${driver._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setError("เกิดข้อผิดพลาด"); return }
      onSaved(await res.json())
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    const fullName = `${driver.firstName} ${driver.lastName}`
    if (!confirm(`ลบข้อมูล "${fullName}" ออกถาวร?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/drivers/${driver._id}`, { method: "DELETE" })
      onDeleted()
    } finally { setDeleting(false) }
  }

  const Div = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )

  const fullName = `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim()

  return (
    <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">

      {/* ── Sticky header ── */}
      <div className="shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">แก้ไขข้อมูลพนักงาน</p>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">{fullName || "—"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="h-8 px-3 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />ลบพนักงาน
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : <><Check className="w-3.5 h-3.5" />บันทึกการแก้ไข</>}
          </Button>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 rounded-xl border border-red-100 dark:border-red-900/40">{error}</p>}

          {/* ── ข้อมูลส่วนตัว ── */}
          <div className="space-y-4">
            <Div label="ข้อมูลส่วนตัว" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">ชื่อ *</label>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className="h-10 text-sm" placeholder="ชื่อ" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">นามสกุล *</label>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className="h-10 text-sm" placeholder="นามสกุล" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">วันเดือนปีเกิด</label>
                <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} className="h-10 text-sm" />
                {form.birthDate && <p className="text-[10px] text-zinc-400 mt-1">อายุ {calcAge(form.birthDate)} ปี</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">เลขบัตรประชาชน</label>
                <Input
                  value={form.nationalId}
                  onChange={(e) => set("nationalId", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  className="h-10 text-sm font-mono tracking-widest"
                  placeholder="0000000000000"
                  maxLength={13}
                />
                <p className="text-[10px] text-zinc-400 mt-1">{form.nationalId.length}/13 หลัก</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">ที่อยู่</label>
                <textarea
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 placeholder:text-zinc-300"
                  placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                />
              </div>
            </div>
          </div>

          {/* ── ข้อมูลการทำงาน ── */}
          <div className="space-y-4">
            <Div label="ข้อมูลการทำงาน" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">รหัสพนักงาน</label>
                <Input value={form.staffCode} onChange={(e) => set("staffCode", e.target.value)} className="h-10 text-sm" placeholder="EMP-001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">เบอร์โทรศัพท์</label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="h-10 text-sm" placeholder="081-234-5678" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">ธนาคาร</label>
                <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className="h-10 text-sm" placeholder="กสิกรไทย / กรุงไทย..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">เลขที่บัญชี</label>
                <Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} className="h-10 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">เริ่มงานวันที่</label>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="h-10 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">สิ้นสุดวันที่</label>
                <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className="h-10 text-sm" />
              </div>
            </div>
          </div>

          {/* ── ใบขับขี่ ── */}
          <div className="space-y-4">
            <Div label="ใบขับขี่" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">เลขบัตรใบขับขี่</label>
                <Input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} className="h-10 text-sm font-mono" placeholder="12345678" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">ประเภทใบขับขี่</label>
                <select
                  value={form.licenseType}
                  onChange={(e) => set("licenseType", e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700"
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
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">วันหมดอายุ</label>
                <Input type="date" value={form.licenseExpiry} onChange={(e) => set("licenseExpiry", e.target.value)} className="h-10 text-sm" />
              </div>
            </div>
          </div>

          {/* ── เอกสาร ── */}
          <div className="space-y-4">
            <Div label="เอกสารแนบ" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([
                { field: "idCardUrl",   label: "บัตรประชาชน" },
                { field: "licenseUrl",  label: "ใบขับขี่" },
                { field: "houseRegUrl", label: "ทะเบียนบ้าน" },
              ] as { field: "idCardUrl" | "licenseUrl" | "houseRegUrl"; label: string }[]).map(({ field, label }) => {
                const url  = form[field] as string
                const busy = uploadingDoc === field
                return (
                  <div key={field} className="space-y-2">
                    <p className="text-xs font-medium text-zinc-500">{label}</p>
                    {url ? (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                        <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
                        <a href={url} target="_blank" rel="noreferrer"
                          className="flex-1 text-sm text-emerald-600 hover:underline flex items-center gap-1.5">
                          ดูไฟล์ <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button type="button" onClick={() => set(field, "")}
                          className="text-zinc-300 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                        ${busy
                          ? "border-blue-300 bg-blue-50/40 dark:bg-blue-950/10 dark:border-blue-700"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10"
                        }`}>
                        {busy ? (
                          <>
                            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                            <span className="text-sm text-blue-600 font-medium">กำลังอัปโหลด...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-zinc-400 shrink-0" />
                            <span className="text-sm text-zinc-500">แนบไฟล์</span>
                          </>
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
          </div>

          {/* ── สถานะ + บทบาท ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Div label="สถานะ" />
              <div className="flex gap-2">
                {([{ v: "active", l: "ใช้งาน" }, { v: "inactive", l: "ไม่ใช้งาน" }] as { v: "active" | "inactive"; l: string }[]).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => set("status", opt.v)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      form.status === opt.v
                        ? opt.v === "active" ? "bg-emerald-600 text-white border-transparent" : "bg-zinc-600 text-white border-transparent"
                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Div label="บทบาท" />
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isDriver} onChange={(e) => set("isDriver", e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">พนักงานขับรถ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isTruckOwner} onChange={(e) => set("isTruckOwner", e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">เจ้าของรถ</span>
                </label>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Display building blocks ──────────────────────────────────────────────────

function Card({ title, action, children, className = "" }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{title}</span>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, value, mono = false, className = "" }: {
  label: string; value?: React.ReactNode; mono?: boolean; className?: string
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm text-zinc-800 dark:text-zinc-200 ${mono ? "font-mono tracking-wide" : ""}`}>
        {value || <span className="text-zinc-300 dark:text-zinc-600">—</span>}
      </div>
    </div>
  )
}

function DocThumb({ url, label }: { url?: string; label: string }) {
  if (!url) return (
    <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-1 text-zinc-300 dark:text-zinc-700 min-h-[7.5rem]">
      <FileText className="w-6 h-6" />
      <span className="text-[11px] font-medium">{label}</span>
      <span className="text-[10px]">ยังไม่ได้แนบ</span>
    </div>
  )
  const isPdf = /\.pdf($|\?)/i.test(url)
  return (
    <a
      href={url} target="_blank" rel="noreferrer"
      className="group rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:border-emerald-400 hover:shadow-sm transition-all"
    >
      <div className="h-24 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
        {isPdf ? (
          <div className="flex flex-col items-center gap-1 text-red-400">
            <FileText className="w-8 h-8" />
            <span className="text-[10px] font-bold">PDF</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between bg-white dark:bg-zinc-900">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
        <ExternalLink className="w-3 h-3 text-zinc-300 group-hover:text-emerald-500" />
      </div>
    </a>
  )
}

const LICENSE_TYPE_LABEL: Record<string, string> = {
  "ท.1": "รถยนต์ส่วนบุคคล",
  "ท.2": "รถยนต์สาธารณะ",
  "ท.3": "รถยนต์ขนส่ง",
  "ท.4": "รถยนต์บรรทุกส่วนบุคคล",
  "ท.5": "รถยนต์สามล้อ",
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DriverDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const router     = useRouter()
  const { data: session } = useSession()
  const isAdmin    = session?.user?.role === "admin"

  const [driver, setDriver]   = useState<Driver | null>(null)
  const [contract, setContract] = useState<Contract | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/drivers/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setDriver)
  }, [id])

  // สัญญาที่ผูกกับพนักงานคนนี้ (ผ่าน contractCode ที่ sync มาจากสัญญา)
  const contractCode = driver?.contractCode
  useEffect(() => {
    if (!contractCode) { setContract(null); return }
    fetch(`/api/contracts?q=${encodeURIComponent(contractCode)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: Contract[]) =>
        setContract(list.find((c) => c.contractCode === contractCode) ?? list[0] ?? null))
  }, [contractCode])

  async function handleDelete() {
    if (!driver) return
    const fullName = `${driver.firstName} ${driver.lastName}`
    if (!confirm(`ลบข้อมูล "${fullName}" ออกถาวร?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/drivers/${id}`, { method: "DELETE" })
      router.push("/drivers")
    } finally { setDeleting(false) }
  }

  if (!driver) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-xs text-zinc-400 animate-pulse">กำลังโหลด...</p>
    </div>
  )

  const fullName = `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim()
  const age      = calcAge(driver.birthDate)
  const initial  = (driver.firstName ?? "?")[0]?.toUpperCase() ?? "?"

  // ── ใบขับขี่: หมดอายุ / ใกล้หมดใน 60 วัน ──
  const today = new Date().toISOString().slice(0, 10)
  const d60 = new Date(); d60.setDate(d60.getDate() + 60)
  const in60 = d60.toISOString().slice(0, 10)
  const licExpired  = !!driver.licenseExpiry && driver.licenseExpiry < today
  const licExpiring = !licExpired && !!driver.licenseExpiry && driver.licenseExpiry <= in60

  // ── ข้อมูลที่เอกสารสัญญาเช่าซื้อดึงจากพนักงาน — เช็คความพร้อม ──
  const contractReq = [
    { label: "วันเกิด",          ok: !!driver.birthDate },
    { label: "เลขบัตรประชาชน",   ok: !!driver.nationalId },
    { label: "ที่อยู่",           ok: !!driver.address },
    { label: "ธนาคาร + เลขบัญชี", ok: !!(driver.bankName && driver.accountNumber) },
  ]
  const reqMissing = contractReq.filter((r) => !r.ok)

  const hasLicenseInfo = driver.licenseNumber || driver.licenseType || driver.licenseExpiry

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">

      {/* Back */}
      <Link href="/drivers" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />กลับรายการพนักงาน
      </Link>

      {/* Edit form full-screen overlay */}
      {editing && (
        <EditForm
          driver={driver}
          onSaved={(updated) => { setDriver(updated); setEditing(false) }}
          onCancel={() => setEditing(false)}
          onDeleted={() => router.push("/drivers")}
        />
      )}

      {!editing && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-4 items-start">

          {/* ══ ซ้าย: โปรไฟล์ + ลิงก์ที่เกี่ยวข้อง ══ */}
          <div className="space-y-4">

            {/* Profile card */}
            <Card>
              <div className="flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold ${avatarColor(driver.firstName ?? "")}`}>
                  {initial}
                </div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-3">{fullName || "—"}</h1>
                {driver.staffCode && <p className="text-xs text-zinc-400 font-mono mt-0.5">{driver.staffCode}</p>}
                <div className="flex items-center justify-center gap-1.5 mt-2.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    driver.status === "active"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${driver.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                    {driver.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                  </span>
                  {driver.isDriver     && <span className="text-[11px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">พนักงานขับรถ</span>}
                  {driver.isTruckOwner && <span className="text-[11px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">เจ้าของรถ</span>}
                </div>
                {age !== null && <p className="text-xs text-zinc-400 mt-2">อายุ {age} ปี</p>}

                {isAdmin && (
                  <div className="flex items-center gap-2 mt-4 w-full">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 flex-1" onClick={() => setEditing(true)}>
                      <Pencil className="w-3 h-3" />แก้ไขข้อมูล
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-8 px-2.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={handleDelete} disabled={deleting}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Quick contact */}
              <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" />
                  {driver.phone
                    ? <a href={`tel:${driver.phone}`} className="text-zinc-700 dark:text-zinc-200 hover:text-emerald-600 font-medium">{driver.phone}</a>
                    : <span className="text-zinc-300 dark:text-zinc-600">ไม่มีเบอร์โทร</span>}
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Landmark className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" />
                  {driver.bankName || driver.accountNumber
                    ? <span className="text-zinc-700 dark:text-zinc-200">
                        {driver.bankName}
                        {driver.accountNumber && <span className="font-mono text-xs text-zinc-400 ml-1.5">{driver.accountNumber}</span>}
                      </span>
                    : <span className="text-zinc-300 dark:text-zinc-600">ไม่มีข้อมูลบัญชี</span>}
                </div>
              </div>
            </Card>

            {/* สัญญา / รถ ที่ผูกอยู่ */}
            {(contract || driver.contractCode || driver.licensePlate) && (
              <Card title="สัญญาเช่าซื้อ / รถ">
                <div className="space-y-3">
                  {(contract || driver.contractCode) && (
                    contract?._id ? (
                      <Link
                        href={`/contracts/${contract._id}`}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors group"
                      >
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 font-mono">{contract.contractCode}</div>
                          <div className="text-[11px] text-zinc-400 truncate">{contract.buyerName}</div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <FileText className="w-4 h-4 text-zinc-300 shrink-0" />
                        <span className="text-sm font-mono text-zinc-500">{driver.contractCode}</span>
                      </div>
                    )
                  )}
                  {(driver.licensePlate || driver.truckNumber) && (
                    <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <Truck className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div>
                        {driver.licensePlate && <span className="text-sm font-mono font-semibold text-zinc-700 dark:text-zinc-200">{driver.licensePlate}</span>}
                        {driver.truckNumber && <span className="text-xs text-zinc-400 ml-2">{driver.truckNumber}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* ความพร้อมข้อมูลสำหรับเอกสารสัญญา */}
            <Card title="ข้อมูลสำหรับทำสัญญา">
              <div className="space-y-2">
                {contractReq.map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    {ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    <span className={ok ? "text-zinc-600 dark:text-zinc-300" : "text-amber-600 dark:text-amber-400 font-medium"}>{label}</span>
                  </div>
                ))}
              </div>
              {reqMissing.length > 0 ? (
                <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mt-3">
                  ขาด {reqMissing.length} รายการ — เอกสารสัญญาจะมีช่องว่างให้เติมมือ
                  {isAdmin && (
                    <button onClick={() => setEditing(true)} className="underline font-semibold ml-1 hover:text-amber-700">กรอกเลย →</button>
                  )}
                </p>
              ) : (
                <p className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 mt-3">
                  ✓ ครบถ้วน พร้อมใช้ออกเอกสารสัญญา
                </p>
              )}
            </Card>
          </div>

          {/* ══ ขวา: รายละเอียด ══ */}
          <div className="space-y-4">

            <Card title="ข้อมูลส่วนตัว">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="ชื่อ – นามสกุล" value={fullName} />
                <Field
                  label="วันเกิด"
                  value={driver.birthDate ? `${formatThaiDate(driver.birthDate)}${age !== null ? ` (${age} ปี)` : ""}` : undefined}
                />
                <Field
                  label="เลขบัตรประชาชน" mono
                  value={driver.nationalId?.replace(/(\d)(\d{4})(\d{5})(\d{2})(\d)/, "$1-$2-$3-$4-$5")}
                />
                <Field label="เบอร์โทรศัพท์" value={driver.phone} />
                <Field
                  label="ที่อยู่" className="col-span-2"
                  value={driver.address ? <span className="whitespace-pre-wrap leading-relaxed">{driver.address}</span> : undefined}
                />
              </div>
            </Card>

            <Card title="ข้อมูลการทำงาน">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <Field label="รหัสพนักงาน" value={driver.staffCode} mono />
                <Field label="เริ่มงานวันที่" value={driver.startDate ? formatThaiDate(driver.startDate) : undefined} />
                <Field label="สิ้นสุดวันที่" value={driver.endDate ? formatThaiDate(driver.endDate) : undefined} />
                <Field label="ธนาคาร" value={driver.bankName} />
                <Field label="เลขที่บัญชี" value={driver.accountNumber} mono />
                <Field
                  label="บทบาท"
                  value={[driver.isDriver && "พนักงานขับรถ", driver.isTruckOwner && "เจ้าของรถ"].filter(Boolean).join(" · ") || undefined}
                />
              </div>
            </Card>

            <Card
              title="ใบขับขี่"
              action={
                licExpired ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> หมดอายุแล้ว
                  </span>
                ) : licExpiring ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> ใกล้หมดอายุ
                  </span>
                ) : undefined
              }
            >
              {hasLicenseInfo ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                  <Field label="เลขบัตรใบขับขี่" value={driver.licenseNumber} mono />
                  <Field
                    label="ประเภท"
                    value={driver.licenseType
                      ? <>{driver.licenseType}{LICENSE_TYPE_LABEL[driver.licenseType] && <span className="text-xs text-zinc-400 ml-1.5">{LICENSE_TYPE_LABEL[driver.licenseType]}</span>}</>
                      : undefined}
                  />
                  <Field
                    label="วันหมดอายุ"
                    value={driver.licenseExpiry
                      ? <span className={licExpired ? "text-red-600 font-semibold" : licExpiring ? "text-amber-600 font-semibold" : ""}>
                          {formatThaiDate(driver.licenseExpiry)}
                        </span>
                      : undefined}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-sm text-zinc-300 dark:text-zinc-600">
                  <IdCard className="w-4 h-4" /> ยังไม่มีข้อมูลใบขับขี่
                  {isAdmin && (
                    <button onClick={() => setEditing(true)} className="text-emerald-600 hover:underline text-xs font-medium">+ เพิ่มข้อมูล</button>
                  )}
                </div>
              )}
            </Card>

            <Card
              title="เอกสารแนบ"
              action={
                <span className="text-[10px] text-zinc-400">
                  {[driver.idCardUrl, driver.licenseUrl, driver.houseRegUrl].filter(Boolean).length}/3 ไฟล์
                </span>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DocThumb url={driver.idCardUrl}   label="บัตรประชาชน" />
                <DocThumb url={driver.licenseUrl}  label="ใบขับขี่" />
                <DocThumb url={driver.houseRegUrl} label="ทะเบียนบ้าน" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {!editing && !driver.firstName && (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-300 dark:text-zinc-700">
          <User className="w-10 h-10" />
          <p className="text-sm">ยังไม่มีข้อมูล</p>
          {isAdmin && (
            <Button size="sm" variant="outline" className="text-xs mt-1" onClick={() => setEditing(true)}>กรอกข้อมูล</Button>
          )}
        </div>
      )}
    </div>
  )
}
