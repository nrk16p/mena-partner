"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, Pencil, Trash2, User, Upload, FileText, ExternalLink, Check, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3 border-b border-zinc-50 dark:border-zinc-800/60 last:border-0">
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-zinc-800 dark:text-zinc-200 flex-1">{value || "—"}</span>
    </div>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DriverDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const router     = useRouter()
  const { data: session } = useSession()
  const isAdmin    = session?.user?.role === "admin"

  const [driver, setDriver]   = useState<Driver | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/drivers/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setDriver)
  }, [id])

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

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">

      {/* Back */}
      <Link href="/drivers" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />กลับรายการพนักงาน
      </Link>

      {/* Profile header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 ${avatarColor(driver.firstName ?? "")}`}>
              {initial}
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{fullName || "—"}</h1>
              {driver.staffCode && (
                <p className="text-xs text-zinc-400 font-mono mt-0.5">{driver.staffCode}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  driver.status === "active"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${driver.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                  {driver.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                </span>
                {driver.isDriver     && <span className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">พนักงานขับรถ</span>}
                {driver.isTruckOwner && <span className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">เจ้าของรถ</span>}
                {age !== null && <span className="text-xs text-zinc-400">{age} ปี</span>}
              </div>
            </div>
          </div>

          {isAdmin && !editing && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="w-3 h-3" />แก้ไข
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-8 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleDelete} disabled={deleting}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit form full-screen overlay */}
      {editing && (
        <EditForm
          driver={driver}
          onSaved={(updated) => { setDriver(updated); setEditing(false) }}
          onCancel={() => setEditing(false)}
          onDeleted={() => router.push("/drivers")}
        />
      )}

      {/* Info display */}
      {!editing && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-2">
          <SectionLabel label="ข้อมูลส่วนตัว" />
          <InfoRow label="ชื่อ" value={driver.firstName} />
          <InfoRow label="นามสกุล" value={driver.lastName} />
          <InfoRow
            label="วันเกิด"
            value={driver.birthDate
              ? `${formatThaiDate(driver.birthDate)}${age !== null ? ` (${age} ปี)` : ""}`
              : undefined
            }
          />
          <InfoRow
            label="เลขบัตร ปชช."
            value={driver.nationalId
              ? <span className="font-mono tracking-widest">{driver.nationalId.replace(/(\d)(\d{4})(\d{5})(\d{2})(\d)/, "$1-$2-$3-$4-$5")}</span>
              : undefined
            }
          />
          <InfoRow
            label="ที่อยู่"
            value={driver.address
              ? <span className="whitespace-pre-wrap leading-relaxed">{driver.address}</span>
              : undefined
            }
          />

          <SectionLabel label="ข้อมูลการทำงาน" />
          <InfoRow label="รหัสพนักงาน"  value={driver.staffCode} />
          <InfoRow label="เบอร์โทรศัพท์" value={driver.phone} />
          <InfoRow label="ธนาคาร"        value={driver.bankName} />
          <InfoRow label="เลขที่บัญชี"   value={driver.accountNumber} />

          <InfoRow label="เริ่มงานวันที่" value={driver.startDate ? formatThaiDate(driver.startDate) : undefined} />
          <InfoRow label="สิ้นสุดวันที่"  value={driver.endDate   ? formatThaiDate(driver.endDate)   : undefined} />
          <InfoRow
            label="บทบาท"
            value={[driver.isDriver && "พนักงานขับรถ", driver.isTruckOwner && "เจ้าของรถ"].filter(Boolean).join(" · ") || undefined}
          />

          {(driver.licenseNumber || driver.licenseType || driver.licenseExpiry) && (
            <>
              <SectionLabel label="ใบขับขี่" />
              <InfoRow label="เลขบัตรใบขับขี่" value={driver.licenseNumber ? <span className="font-mono">{driver.licenseNumber}</span> : undefined} />
              <InfoRow label="ประเภท"          value={driver.licenseType} />
              <InfoRow label="วันหมดอายุ"      value={driver.licenseExpiry ? formatThaiDate(driver.licenseExpiry) : undefined} />
            </>
          )}

          {(driver.idCardUrl || driver.licenseUrl || driver.houseRegUrl) && (
            <>
              <SectionLabel label="เอกสาร" />
              {([
                { url: driver.idCardUrl,   label: "บัตรประชาชน" },
                { url: driver.licenseUrl,  label: "ใบขับขี่" },
                { url: driver.houseRegUrl, label: "ทะเบียนบ้าน" },
              ] as { url?: string; label: string }[])
                .filter((d) => d.url)
                .map(({ url, label }) => (
                  <InfoRow
                    key={label}
                    label={label}
                    value={
                      <a href={url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                        <ExternalLink className="w-3.5 h-3.5" />ดูไฟล์
                      </a>
                    }
                  />
                ))
              }
            </>
          )}
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
