"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Search, Plus, X, Check, Car, Trash2, ChevronRight, Upload, FileText, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Vehicle } from "@/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatThaiDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
}

// ─── Form fields config ───────────────────────────────────────────────────────

const FORM_FIELDS: { key: keyof Vehicle; label: string; type?: string; placeholder?: string; section: string }[] = [
  // Section: ข้อมูลทั่วไป
  { key: "vehicleType",    label: "ประเภทรถ",                  placeholder: "รถบรรทุก / รถผสมปูน", section: "ข้อมูลทั่วไป" },
  { key: "characteristic", label: "ลักษณะ",                    placeholder: "10 ล้อ / 6 ล้อ",       section: "ข้อมูลทั่วไป" },
  { key: "brand",          label: "ยี่ห้อ",                    placeholder: "ISUZU / HINO",           section: "ข้อมูลทั่วไป" },
  { key: "model",          label: "รุ่น",                      placeholder: "FVM34W",                 section: "ข้อมูลทั่วไป" },
  { key: "color",          label: "สีรถ",                      placeholder: "ขาว / เทา",             section: "ข้อมูลทั่วไป" },
  // Section: ทะเบียน
  { key: "licensePlate",     label: "ทะเบียนรถ",               placeholder: "สบ.71-1956",            section: "ทะเบียน" },
  { key: "truckNumber",      label: "เบอร์รถ",                 placeholder: "ME009",                  section: "ทะเบียน" },
  { key: "registrationDate", label: "วันจดทะเบียน",            type: "date",                          section: "ทะเบียน" },
  // Section: ตัวถัง / เครื่องยนต์
  { key: "chassisNumber", label: "เลขตัวถัง",                  placeholder: "NKRHF…",                section: "ตัวถัง / เครื่องยนต์" },
  { key: "engineNumber",  label: "เลขเครื่อง",                 placeholder: "6HK1…",                 section: "ตัวถัง / เครื่องยนต์" },
  { key: "engineSize",    label: "ขนาดกำลังเครื่องยนต์",      placeholder: "7790 cc / 240 hp",      section: "ตัวถัง / เครื่องยนต์" },
]

const EMPTY_FORM: Omit<Vehicle, "_id" | "createdAt" | "updatedAt"> = {
  vehicleType: "", characteristic: "", brand: "", model: "",
  registrationDate: "", color: "", licensePlate: "", truckNumber: "",
  chassisNumber: "", engineNumber: "", engineSize: "", status: "active",
  registrationDocUrl: "",
}

// ─── Slide panel ─────────────────────────────────────────────────────────────

interface SlidePanelProps {
  vehicle: Vehicle | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

function SlidePanel({ vehicle, onClose, onSaved, onDeleted }: SlidePanelProps) {
  const isEdit = !!vehicle
  const [form, setForm]       = useState({ ...EMPTY_FORM })
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [error,       setError]       = useState("")
  const [uploading,   setUploading]   = useState(false)

  useEffect(() => {
    if (vehicle) {
      setForm({
        vehicleType:         vehicle.vehicleType         ?? "",
        characteristic:      vehicle.characteristic      ?? "",
        brand:               vehicle.brand               ?? "",
        model:               vehicle.model               ?? "",
        registrationDate:    vehicle.registrationDate    ?? "",
        color:               vehicle.color               ?? "",
        licensePlate:        vehicle.licensePlate        ?? "",
        truckNumber:         vehicle.truckNumber         ?? "",
        chassisNumber:       vehicle.chassisNumber       ?? "",
        engineNumber:        vehicle.engineNumber        ?? "",
        engineSize:          vehicle.engineSize          ?? "",
        status:              vehicle.status              ?? "active",
        registrationDocUrl:  vehicle.registrationDocUrl  ?? "",
      })
    } else {
      setForm({ ...EMPTY_FORM })
    }
    setError("")
  }, [vehicle])

  async function uploadDoc(file: File) {
    setUploading(true); setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "vehicles")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      set("registrationDocUrl" as keyof typeof EMPTY_FORM, url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function set(key: keyof typeof EMPTY_FORM, val: string) {
    setForm((p) => ({ ...p, [key]: val }))
  }

  async function handleSave() {
    setSaving(true); setError("")
    try {
      const url    = isEdit ? `/api/vehicles/${vehicle!._id}` : "/api/vehicles"
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

  async function handleDelete() {
    if (!vehicle || !confirm(`ลบ ${vehicle.truckNumber || vehicle.licensePlate || "รถคันนี้"} ออกถาวร?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/vehicles/${vehicle._id}`, { method: "DELETE" })
      onDeleted(); onClose()
    } finally { setDeleting(false) }
  }

  // Group fields by section
  const sections = Array.from(new Set(FORM_FIELDS.map((f) => f.section)))

  const Div = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">

      {/* ── Sticky header ── */}
      <div className="shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">ข้อมูลรถ</p>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">
            {isEdit ? (vehicle!.truckNumber || vehicle!.licensePlate || "แก้ไขข้อมูล") : "เพิ่มรถใหม่"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="h-8 px-3 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />ลบรถ
            </Button>
          )}
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : <><Check className="w-3.5 h-3.5" />{isEdit ? "บันทึกการแก้ไข" : "เพิ่มรถ"}</>}
          </Button>
          <button
            onClick={onClose}
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

          {/* ── ข้อมูลทั่วไป ── */}
          <div>
            <Div label="ข้อมูลทั่วไป" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {FORM_FIELDS.filter((f) => f.section === "ข้อมูลทั่วไป").map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">{f.label}</label>
                  <Input
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={String(form[f.key as keyof typeof form] ?? "")}
                    onChange={(e) => set(f.key as keyof typeof EMPTY_FORM, e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── ทะเบียน ── */}
          <div>
            <Div label="ทะเบียน" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {FORM_FIELDS.filter((f) => f.section === "ทะเบียน").map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">{f.label}</label>
                  <Input
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={String(form[f.key as keyof typeof form] ?? "")}
                    onChange={(e) => set(f.key as keyof typeof EMPTY_FORM, e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── ตัวถัง / เครื่องยนต์ ── */}
          <div>
            <Div label="ตัวถัง / เครื่องยนต์" />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {FORM_FIELDS.filter((f) => f.section === "ตัวถัง / เครื่องยนต์").map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">{f.label}</label>
                  <Input
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={String(form[f.key as keyof typeof form] ?? "")}
                    onChange={(e) => set(f.key as keyof typeof EMPTY_FORM, e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── สถานะ + เอกสารแนบ ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* สถานะ */}
            <div>
              <Div label="สถานะ" />
              <div className="flex gap-2 mt-4">
                {[
                  { value: "active",   label: "ใช้งาน",    cls: "bg-emerald-600 text-white" },
                  { value: "inactive", label: "ไม่ใช้งาน", cls: "bg-zinc-500 text-white" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("status", opt.value)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      form.status === opt.value
                        ? opt.cls + " border-transparent"
                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* เอกสารแนบ */}
            <div>
              <Div label="เอกสารแนบ" />
              <div className="mt-4">
                {form.registrationDocUrl ? (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
                    <a
                      href={form.registrationDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-sm text-emerald-600 hover:underline flex items-center gap-1.5"
                    >
                      สำเนาทะเบียนรถ <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => set("registrationDocUrl" as keyof typeof EMPTY_FORM, "")}
                      className="text-zinc-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                    ${uploading
                      ? "border-blue-300 bg-blue-50/40 dark:bg-blue-950/10 dark:border-blue-700"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10"
                    }`}>
                    {uploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span className="text-sm text-blue-600 font-medium">กำลังอัปโหลด...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-zinc-400 shrink-0" />
                        <div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium">แนบสำเนาทะเบียนรถ</p>
                          <p className="text-xs text-zinc-400 mt-0.5">PDF หรือรูปภาพ • สูงสุด 20 MB</p>
                        </div>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = "" }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { key: "truckNumber",   label: "เบอร์รถ",       w: "w-24" },
  { key: "licensePlate",  label: "ทะเบียนรถ",     w: "w-32" },
  { key: "vehicleType",   label: "ประเภทรถ",      w: "w-32" },
  { key: "characteristic",label: "ลักษณะ",        w: "w-24" },
  { key: "brand",         label: "ยี่ห้อ",        w: "w-24" },
  { key: "model",         label: "รุ่น",          w: "w-28" },
  { key: "color",         label: "สีรถ",          w: "w-20" },
  { key: "registrationDate", label: "วันจดทะเบียน", w: "w-28" },
  { key: "chassisNumber", label: "เลขตัวถัง",     w: "w-36" },
  { key: "engineNumber",  label: "เลขเครื่อง",    w: "w-28" },
  { key: "engineSize",    label: "กำลังเครื่อง",  w: "w-28" },
  { key: "status",        label: "สถานะ",         w: "w-24" },
]

type StatusFilter = "" | "active" | "inactive"

export default function VehiclesPage() {
  const [items, setItems]               = useState<Vehicle[]>([])
  const [q, setQ]                       = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("")
  const [loading, setLoading]           = useState(true)
  const [panel, setPanel]               = useState<Vehicle | null | "new">(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/vehicles?${params}`)
      if (res.ok) setItems(await res.json())
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!q) return items
    const lq = q.toLowerCase()
    return items.filter((v) =>
      [v.truckNumber, v.licensePlate, v.brand, v.model, v.vehicleType,
       v.chassisNumber, v.engineNumber, v.characteristic]
        .some((f) => (f ?? "").toLowerCase().includes(lq))
    )
  }, [items, q])

  const activeCount   = items.filter((v) => v.status === "active").length
  const inactiveCount = items.filter((v) => v.status !== "active").length
  const showPanel     = panel !== null
  const editVehicle   = panel === "new" ? null : panel

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">ข้อมูลยานพาหนะ</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">ทะเบียนรถ</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{activeCount} ใช้งาน · {inactiveCount} ไม่ใช้งาน</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm gap-1.5"
          onClick={() => setPanel("new")}
        >
          <Plus className="w-4 h-4" />เพิ่มรถ
        </Button>
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
            placeholder="ค้นหาทะเบียน / เบอร์รถ / ยี่ห้อ / เลขตัวถัง..."
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
                {TABLE_COLS.map((col) => (
                  <th key={col.key} className={`px-3 py-2.5 text-left font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap ${col.w}`}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COLS.length + 1} className="px-4 py-10 text-center text-zinc-400 animate-pulse">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS.length + 1} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-zinc-300">
                      <Car className="w-8 h-8" />
                      <p className="text-sm text-zinc-400">ไม่พบรถ</p>
                      {q && <button className="text-xs text-zinc-400 underline" onClick={() => setQ("")}>ล้างการค้นหา</button>}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                    {/* เบอร์รถ */}
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100 font-mono">{v.truckNumber || "—"}</span>
                    </td>

                    {/* ทะเบียน */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{v.licensePlate || "—"}</span>
                        {v.registrationDocUrl && (
                          <a
                            href={v.registrationDocUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="ดูสำเนาทะเบียนรถ"
                            className="text-zinc-300 hover:text-emerald-500 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* ประเภทรถ */}
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{v.vehicleType || "—"}</td>

                    {/* ลักษณะ */}
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{v.characteristic || "—"}</td>

                    {/* ยี่ห้อ */}
                    <td className="px-3 py-2.5">
                      {v.brand
                        ? <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-medium">{v.brand}</span>
                        : <span className="text-zinc-300">—</span>
                      }
                    </td>

                    {/* รุ่น */}
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{v.model || "—"}</td>

                    {/* สี */}
                    <td className="px-3 py-2.5 text-zinc-500">{v.color || "—"}</td>

                    {/* วันจดทะเบียน */}
                    <td className="px-3 py-2.5 tabular-nums text-zinc-500">{formatThaiDateShort(v.registrationDate)}</td>

                    {/* เลขตัวถัง */}
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-zinc-500 text-[10px] tracking-wider">{v.chassisNumber || "—"}</span>
                    </td>

                    {/* เลขเครื่อง */}
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-zinc-500 text-[10px] tracking-wider">{v.engineNumber || "—"}</span>
                    </td>

                    {/* กำลังเครื่อง */}
                    <td className="px-3 py-2.5 text-zinc-500">{v.engineSize || "—"}</td>

                    {/* สถานะ */}
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        v.status === "active"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${v.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                        {v.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setPanel(v)}
                          className="px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                        >
                          แก้ไข
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-zinc-50 dark:border-zinc-800">
            <p className="text-[11px] text-zinc-400">
              {q ? `แสดง ${filtered.length} จาก ${items.length} คัน` : `ทั้งหมด ${filtered.length} คัน`}
            </p>
          </div>
        )}
      </div>

      {showPanel && (
        <SlidePanel
          vehicle={editVehicle}
          onClose={() => setPanel(null)}
          onSaved={load}
          onDeleted={load}
        />
      )}
    </div>
  )
}
