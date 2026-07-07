"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Search, X, ChevronDown, Tag, Upload, Trash2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ContractDocument, normPlate, type PromoMaster } from "@/components/contract-document"
import { missingDocFields } from "@/lib/contract-doc"
import type { Contract, Driver, Vehicle } from "@/types"

// ─── types ─────────────────────────────────────────────────────────────────────

interface PriceRow {
  licensePlate:         string
  totalSalePrice:       number
  downPayment:          number
  cashDown:             number
  remainingInstallment: number
  downInstallmentCount: number
  downInstallmentAmt:   number
  financeAmount:        number
  financeInstallments:  number
  monthlyPayment:       number
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function calcAge(birthDate?: string | null): string {
  if (!birthDate) return ""
  const b = new Date(birthDate)
  const now = new Date()
  const age = now.getFullYear() - b.getFullYear() -
    (now < new Date(now.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
  return String(age)
}

function thaiDate(iso?: string | null): string {
  if (!iso) return ""
  const [y, m, d] = iso.slice(0, 10).split("-")
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
}

function fmt(n?: number | null): string {
  if (!n) return "—"
  return n.toLocaleString("th-TH")
}

// ─── combobox ─────────────────────────────────────────────────────────────────

interface ComboProps<T> {
  items:       T[]
  selected:    T | null
  onSelect:    (item: T | null) => void
  getLabel:    (item: T) => string
  getSub?:     (item: T) => string
  placeholder: string
  searchKeys:  (item: T) => string[]
}

function Combobox<T extends { _id?: string }>({
  items, selected, onSelect, getLabel, getSub, placeholder, searchKeys,
}: ComboProps<T>) {
  const [open, setOpen] = useState(false)
  const [q,    setQ]    = useState("")
  const ref             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = items.filter((item) =>
    !q || searchKeys(item).some((k) => k.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-sm">
          <span className="flex-1 truncate font-medium text-zinc-800 dark:text-zinc-100">{getLabel(selected)}</span>
          {getSub && <span className="text-xs text-zinc-400">{getSub(selected)}</span>}
          <button type="button" onClick={() => { onSelect(null); setQ("") }} className="text-zinc-400 hover:text-zinc-700 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-text"
          onClick={() => setOpen(true)}
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400"
            placeholder={placeholder}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-400">ไม่พบข้อมูล</div>
          ) : filtered.slice(0, 60).map((item) => (
            <button
              key={item._id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between"
              onMouseDown={(e) => { e.preventDefault(); onSelect(item); setOpen(false); setQ("") }}
            >
              <span className="font-medium">{getLabel(item)}</span>
              {getSub && <span className="text-xs text-zinc-400">{getSub(item)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── section wrapper ───────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{title}</span>
        {badge && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">
            <Tag className="w-2.5 h-2.5" /> {badge}
          </span>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-zinc-800 dark:text-zinc-200">{value || <span className="text-zinc-300 dark:text-zinc-600">—</span>}</div>
    </div>
  )
}

// ─── form state ────────────────────────────────────────────────────────────────

interface FormState {
  contractCode:            string
  contractDate:            string
  driverId:                string
  buyerName:               string
  driverName:              string
  birthDate:               string
  nationalId:              string
  driverAddress:           string
  phone:                   string
  bankName:                string
  accountNumber:           string
  vehicleId:               string
  vehicleType:             string
  vehicleCharacteristic:   string
  vehicleBrand:            string
  vehicleModel:            string
  vehicleRegistrationDate: string
  vehicleColor:            string
  licensePlate:            string
  truckNumber:             string
  chassisNumber:           string
  engineNumber:            string
  engineSize:              string
  mileage:                 number
  // price fields (from master_price_list by licensePlate)
  totalPrice:              number
  downPayment:             number
  cashDown:                number
  remainingInstallment:    number
  downInstallmentCount:    number
  downInstallmentAmt:      number
  financeAmount:           number
  monthlyInstallment:      number
  totalInstallments:       number
  startDate:               string
  plant:                   string
  status:                  string
  payEveryLastDay:         boolean
  saleContractUrl:         string
  hireContractUrl:         string
  guaranteeContractUrl:    string
  notes:                   string
}

const EMPTY: FormState = {
  contractCode: "", contractDate: new Date().toISOString().slice(0, 10),
  driverId: "", buyerName: "", driverName: "", birthDate: "", nationalId: "",
  driverAddress: "", phone: "", bankName: "", accountNumber: "",
  vehicleId: "", vehicleType: "", vehicleCharacteristic: "", vehicleBrand: "",
  vehicleModel: "", vehicleRegistrationDate: "", vehicleColor: "",
  licensePlate: "", truckNumber: "", chassisNumber: "", engineNumber: "", engineSize: "", mileage: 0,
  totalPrice: 0, downPayment: 0, cashDown: 0, remainingInstallment: 0,
  downInstallmentCount: 0, downInstallmentAmt: 0, financeAmount: 0,
  monthlyInstallment: 0, totalInstallments: 0,
  startDate: "", plant: "", status: "active", payEveryLastDay: false,
  saleContractUrl: "", hireContractUrl: "", guaranteeContractUrl: "", notes: "",
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function NewContractPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [form,     setForm]     = useState<FormState>(EMPTY)
  const [drivers,  setDrivers]  = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [prices,   setPrices]   = useState<PriceRow[]>([])
  const [promoList, setPromoList] = useState<PromoMaster[]>([])
  const [selectedDriver,  setSelectedDriver]  = useState<Driver  | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState("")
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  // track last plate we auto-filled so we don't override manual edits
  const lastAutoFilledPlate = useRef("")

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v })), [])

  // Load all lookup data on mount
  useEffect(() => {
    fetch("/api/contracts/next-code")
      .then((r) => r.ok ? r.json() : { code: "MTL-001" })
      .then((d) => set("contractCode", d.code))
    fetch("/api/drivers?status=active")
      .then((r) => r.ok ? r.json() : [])
      .then(setDrivers)
    fetch("/api/vehicles")
      .then((r) => r.ok ? r.json() : [])
      .then(setVehicles)
    fetch("/api/price-list")
      .then((r) => r.ok ? r.json() : [])
      .then(setPrices)
    fetch("/api/promotions/master")
      .then((r) => r.ok ? r.json() : [])
      .then(setPromoList)
  }, [set])

  // Auto-fill price whenever licensePlate changes (vehicle selection OR manual input)
  useEffect(() => {
    const plate = form.licensePlate.trim()
    if (!plate || !prices.length) return
    if (plate === lastAutoFilledPlate.current) return   // already filled for this plate
    const pr = prices.find((p) => p.licensePlate === plate)
    if (!pr) return
    lastAutoFilledPlate.current = plate
    setForm((prev) => ({
      ...prev,
      totalPrice:           pr.totalSalePrice,
      downPayment:          pr.downPayment,
      cashDown:             pr.cashDown,
      remainingInstallment: pr.remainingInstallment,
      downInstallmentCount: pr.downInstallmentCount,
      downInstallmentAmt:   pr.downInstallmentAmt,
      financeAmount:        pr.financeAmount,
      monthlyInstallment:   pr.monthlyPayment,
      totalInstallments:    pr.financeInstallments,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.licensePlate, prices])

  // Driver selected → fill personal section
  function handleDriverSelect(d: Driver | null) {
    setSelectedDriver(d)
    if (!d) {
      setForm((p) => ({ ...p, driverId: "", buyerName: "", driverName: "",
        birthDate: "", nationalId: "", driverAddress: "", phone: "" }))
      return
    }
    const fullName = `${d.firstName} ${d.lastName}`.trim()
    setForm((p) => ({
      ...p,
      driverId:      d._id ?? "",
      buyerName:     fullName,
      driverName:    fullName,
      birthDate:     d.birthDate     ?? "",
      nationalId:    d.nationalId    ?? "",
      driverAddress: d.address       ?? "",
      phone:         d.phone         ?? p.phone,
      bankName:      d.bankName      ?? p.bankName,
      accountNumber: d.accountNumber ?? p.accountNumber,
    }))
  }

  // Vehicle selected → fill vehicle section (price lookup handled by effect above)
  function handleVehicleSelect(v: Vehicle | null) {
    setSelectedVehicle(v)
    if (!v) {
      lastAutoFilledPlate.current = ""
      setForm((p) => ({
        ...p,
        vehicleId: "", vehicleType: "", vehicleCharacteristic: "",
        vehicleBrand: "", vehicleModel: "", vehicleRegistrationDate: "",
        vehicleColor: "", licensePlate: "", truckNumber: "",
        chassisNumber: "", engineNumber: "", engineSize: "",
        totalPrice: 0, downPayment: 0, cashDown: 0, remainingInstallment: 0,
        downInstallmentCount: 0, downInstallmentAmt: 0, financeAmount: 0,
        monthlyInstallment: 0, totalInstallments: 0,
      }))
      return
    }
    setForm((p) => ({
      ...p,
      vehicleId:               v._id              ?? "",
      vehicleType:             v.vehicleType      ?? "",
      vehicleCharacteristic:   v.characteristic   ?? "",
      vehicleBrand:            v.brand            ?? "",
      vehicleModel:            v.model            ?? "",
      vehicleRegistrationDate: v.registrationDate ?? "",
      vehicleColor:            v.color            ?? "",
      licensePlate:            v.licensePlate     ?? "",
      truckNumber:             v.truckNumber      ?? "",
      chassisNumber:           v.chassisNumber    ?? "",
      engineNumber:            v.engineNumber     ?? "",
      engineSize:              v.engineSize       ?? "",
    }))
    // price effect will fire from the licensePlate change above
  }

  async function uploadDoc(field: "saleContractUrl" | "hireContractUrl" | "guaranteeContractUrl", file: File) {
    setUploadingDoc(field)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "contracts")
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (session?.user?.role !== "admin") return
    if (!form.contractCode.trim()) { setError("กรุณากรอกรหัสสัญญา"); return }
    if (!form.buyerName.trim())    { setError("กรุณาเลือกหรือกรอกชื่อผู้เช่าซื้อ"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "เกิดข้อผิดพลาด"); return
      }
      router.push("/contracts")
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = session?.user?.role === "admin"
  const priceRow = prices.find((p) => p.licensePlate === form.licensePlate.trim())

  // ── live preview: ใช้เกณฑ์/เอกสารชุดเดียวกับหน้าแก้ไขสัญญา ──
  const previewContract = form as unknown as Contract
  const previewPromo =
    promoList.find((p) => normPlate(p.licensePlate) === normPlate(form.licensePlate)) ?? null
  const missingDoc = missingDocFields(previewContract)

  return (
    <div className="max-w-[1500px]">
      {/* ── ซ้าย: ฟอร์ม | ขวา: preview สัญญาสด (เหมือนหน้าแก้ไขสัญญา) ── */}
      <div className="flex gap-6 items-start">
        <div className="w-full xl:max-w-2xl min-w-0 shrink-0 xl:w-[42rem]">

      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">เพิ่มสัญญาเช่าซื้อ</h1>
        <p className="text-sm text-zinc-400 mt-0.5">กรอกข้อมูลสัญญา เลือกผู้เช่าซื้อ และเลือกรถ</p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── 1. ข้อมูลสัญญา ── */}
        <Section title="ข้อมูลสัญญา">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">รหัสสัญญา <span className="text-red-400">*</span></label>
              <Input
                value={form.contractCode}
                onChange={(e) => set("contractCode", e.target.value)}
                placeholder="MTL-001"
                className="h-9 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">วันที่ทำสัญญา <span className="text-red-400">*</span></label>
              <Input type="date" value={form.contractDate} onChange={(e) => set("contractDate", e.target.value)} className="h-9 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">วันที่เริ่มผ่อนงวดแรก</label>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">สถานะสัญญา</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="active">ใช้งาน</option>
                <option value="completed">สิ้นสุด</option>
                <option value="terminated">ยกเลิก</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="payEveryLastDay"
                checked={form.payEveryLastDay}
                onChange={(e) => set("payEveryLastDay", e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
              />
              <label htmlFor="payEveryLastDay" className="text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
                จ่ายทุกวันสุดท้ายของเดือน
              </label>
            </div>
          </div>
        </Section>

        {/* ── 2. ข้อมูลส่วนบุคคล ── */}
        <Section title="ข้อมูลส่วนบุคคล" badge="พนักงานขับรถ">
          <div className="mb-4">
            <label className="block text-xs text-zinc-400 mb-1">ค้นหาผู้เช่าซื้อ / พนักงานขับรถ</label>
            <Combobox<Driver>
              items={drivers}
              selected={selectedDriver}
              onSelect={handleDriverSelect}
              getLabel={(d) => `${d.firstName} ${d.lastName}`.trim()}
              getSub={(d) => d.staffCode ?? ""}
              placeholder="พิมพ์ชื่อ นามสกุล หรือรหัสพนักงาน..."
              searchKeys={(d) => [d.firstName, d.lastName, d.staffCode ?? "", d.nationalId ?? "", d.phone ?? ""]}
            />
          </div>

          {selectedDriver ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow label="ชื่อ – นามสกุล"     value={`${selectedDriver.firstName} ${selectedDriver.lastName}`} />
                <InfoRow label="อายุ"                value={calcAge(selectedDriver.birthDate) ? `${calcAge(selectedDriver.birthDate)} ปี` : null} />
                <InfoRow label="วันเดือนปีเกิด"      value={thaiDate(selectedDriver.birthDate)} />
                <InfoRow label="เลขบัตรประชาชน"      value={selectedDriver.nationalId} />
                <InfoRow label="ที่อยู่"             value={selectedDriver.address} />
                <InfoRow label="เบอร์โทรศัพท์"       value={selectedDriver.phone} />
                <InfoRow label="ธนาคาร"              value={selectedDriver.bankName} />
                <InfoRow label="เลขที่บัญชี"         value={selectedDriver.accountNumber} />
              </div>

              {(selectedDriver.idCardUrl || selectedDriver.licenseUrl || selectedDriver.houseRegUrl) && (
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">เอกสารแนบ</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { url: selectedDriver.idCardUrl,   label: "บัตรประชาชน" },
                      { url: selectedDriver.licenseUrl,  label: "ใบขับขี่" },
                      { url: selectedDriver.houseRegUrl, label: "ทะเบียนบ้าน" },
                    ] as { url?: string; label: string }[])
                      .filter((d) => d.url)
                      .map(({ url, label }) => (
                        <a
                          key={label}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {label}
                        </a>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ชื่อผู้เช่าซื้อ <span className="text-red-400">*</span></label>
                <Input value={form.buyerName} onChange={(e) => set("buyerName", e.target.value)} className="h-9 text-sm" placeholder="กรอกชื่อ นามสกุล" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">เบอร์โทร</label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="h-9 text-sm" type="tel" />
              </div>
            </div>
          )}

          {!selectedDriver && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ธนาคาร</label>
                <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className="h-9 text-sm" placeholder="กสิกรไทย / กรุงไทย..." />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">เลขที่บัญชี</label>
                <Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} className="h-9 text-sm font-mono" />
              </div>
            </div>
          )}
        </Section>

        {/* ── 3. ข้อมูลรถ ── */}
        <Section title="ข้อมูลรถ" badge="ทะเบียนรถ">
          <div className="mb-4">
            <label className="block text-xs text-zinc-400 mb-1">ค้นหาทะเบียนรถ / เบอร์รถ</label>
            <Combobox<Vehicle>
              items={vehicles.filter((v) => prices.some((p) => p.licensePlate === v.licensePlate))}
              selected={selectedVehicle}
              onSelect={handleVehicleSelect}
              getLabel={(v) => v.licensePlate ?? ""}
              getSub={(v) => [v.truckNumber, v.brand].filter(Boolean).join(" · ")}
              placeholder="พิมพ์ทะเบียน เบอร์รถ หรือยี่ห้อ..."
              searchKeys={(v) => [v.licensePlate ?? "", v.truckNumber ?? "", v.brand ?? "", v.model ?? "", v.chassisNumber ?? ""]}
            />
          </div>

          {selectedVehicle ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="ทะเบียนรถ"              value={selectedVehicle.licensePlate} />
              <InfoRow label="เบอร์รถ"                value={selectedVehicle.truckNumber} />
              <InfoRow label="ประเภทรถ"               value={selectedVehicle.vehicleType} />
              <InfoRow label="ลักษณะ"                 value={selectedVehicle.characteristic} />
              <InfoRow label="ยี่ห้อ"                 value={selectedVehicle.brand} />
              <InfoRow label="รุ่น"                   value={selectedVehicle.model} />
              <InfoRow label="สีรถ"                  value={selectedVehicle.color} />
              <InfoRow label="วันจดทะเบียน"           value={thaiDate(selectedVehicle.registrationDate)} />
              <InfoRow label="เลขตัวถัง"              value={selectedVehicle.chassisNumber} />
              <InfoRow label="เลขเครื่อง"             value={selectedVehicle.engineNumber} />
              <InfoRow label="ขนาดกำลังเครื่องยนต์"   value={selectedVehicle.engineSize} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ทะเบียนรถ</label>
                <Input
                  value={form.licensePlate}
                  onChange={(e) => { set("licensePlate", e.target.value) }}
                  className="h-9 text-sm font-mono"
                  placeholder="สบ.71-1956"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">เบอร์รถ</label>
                <Input value={form.truckNumber} onChange={(e) => set("truckNumber", e.target.value)} className="h-9 text-sm" placeholder="ME009" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ยี่ห้อรถ</label>
                <Input value={form.vehicleBrand} onChange={(e) => set("vehicleBrand", e.target.value)} className="h-9 text-sm" placeholder="HINO" />
              </div>
            </div>
          )}
          <div className="mt-4 w-1/2 pr-2">
            <label className="block text-xs text-zinc-400 mb-1">ระยะทางที่ใช้แล้ว (กม.) — ใช้ในเอกสารสัญญา</label>
            <Input
              type="number"
              value={form.mileage || ""}
              onChange={(e) => set("mileage", Number(e.target.value) || 0)}
              className="h-9 text-sm"
              placeholder="เว้นว่างได้ ถ้าไม่ทราบ"
            />
          </div>
        </Section>

        {/* ── 4. ราคาซื้อและการชำระราคา ── */}
        <Section
          title="ราคาซื้อและการชำระราคา"
          badge={priceRow ? `อ้างอิงจาก ${form.licensePlate}` : undefined}
        >
          {priceRow ? (
            /* ── auto-filled from price-list ── */
            <div className="space-y-4">
              {/* summary strip */}
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 divide-y divide-emerald-100 dark:divide-emerald-900 overflow-hidden text-sm">
                <div className="flex">
                  <div className="flex-1 px-4 py-3 border-r border-emerald-100 dark:border-emerald-900">
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-0.5">ราคาขายรวม</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-100 text-base">{fmt(priceRow.totalSalePrice)} <span className="text-xs font-normal text-zinc-400">บาท</span></div>
                  </div>
                  <div className="flex-1 px-4 py-3 border-r border-emerald-100 dark:border-emerald-900">
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-0.5">ยอดไฟแนนซ์</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-100 text-base">{fmt(priceRow.financeAmount)} <span className="text-xs font-normal text-zinc-400">บาท</span></div>
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-0.5">ค่างวด / เดือน</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-100 text-base">{fmt(priceRow.monthlyPayment)} <span className="text-xs font-normal text-zinc-400">บาท × {priceRow.financeInstallments} งวด</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-emerald-100 dark:divide-emerald-900 text-xs">
                  <div className="px-4 py-2.5">
                    <span className="text-zinc-400">เงินดาวน์รวม</span>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">{fmt(priceRow.downPayment)} บาท</div>
                  </div>
                  <div className="px-4 py-2.5">
                    <span className="text-zinc-400">เงินดาวน์สด</span>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">{fmt(priceRow.cashDown)} บาท</div>
                  </div>
                  <div className="px-4 py-2.5">
                    <span className="text-zinc-400">งวดดาวน์คงเหลือ</span>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">{fmt(priceRow.remainingInstallment)} บาท</div>
                  </div>
                  <div className="px-4 py-2.5">
                    <span className="text-zinc-400">จำนวนงวดดาวน์</span>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">{priceRow.downInstallmentCount} งวด</div>
                  </div>
                  <div className="px-4 py-2.5">
                    <span className="text-zinc-400">ค่างวดดาวน์</span>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">{fmt(priceRow.downInstallmentAmt)} บาท</div>
                  </div>
                  <div className="px-4 py-2.5">
                    <span className="text-zinc-400">จำนวนงวดไฟแนนซ์</span>
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300">{priceRow.financeInstallments} งวด</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── manual entry when no price-list match ── */
            <div>
              {form.licensePlate && (
                <div className="mb-4 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-lg">
                  ไม่พบข้อมูลราคาสำหรับทะเบียน <span className="font-mono font-semibold">{form.licensePlate}</span> — กรอกราคาด้วยตนเอง
                </div>
              )}
              {!form.licensePlate && (
                <div className="mb-4 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg">
                  เลือกทะเบียนรถก่อนเพื่อดึงราคาอัตโนมัติจาก price-list
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {(["totalPrice","downPayment","monthlyInstallment","totalInstallments"] as const).map((k) => (
                  <div key={k}>
                    <label className="block text-xs text-zinc-400 mb-1">
                      {k === "totalPrice" ? "ราคารถรวม (บาท)" :
                       k === "downPayment" ? "เงินดาวน์ (บาท)" :
                       k === "monthlyInstallment" ? "ค่างวด/เดือน (บาท)" : "จำนวนงวดรวม"}
                    </label>
                    <Input
                      type="number" min="0"
                      value={form[k] || ""}
                      onChange={(e) => set(k, Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── เอกสารแนบ ── */}
        {(() => {
          const docs = [
            { field: "saleContractUrl"      as const, label: "สัญญาซื้อขาย" },
            { field: "hireContractUrl"      as const, label: "สัญญาว่าจ้าง" },
            { field: "guaranteeContractUrl" as const, label: "สัญญาค้ำประกัน" },
          ]
          const filled = docs.filter((d) => form[d.field]).length
          return (
            <Section title="เอกสารแนบ" badge={filled > 0 ? `${filled} ไฟล์` : undefined}>
              <p className="text-xs text-zinc-400 mb-4">PDF หรือรูปภาพ • สูงสุด 20 MB ต่อไฟล์</p>
              <div className="space-y-3">
                {docs.map(({ field, label }) => {
                  const url  = form[field]
                  const busy = uploadingDoc === field
                  return (
                    <div key={field} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300 w-36 shrink-0">{label}</span>
                      {url ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
                          <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-xs text-emerald-600 hover:underline truncate"
                          >
                            ดูไฟล์
                          </a>
                          <button
                            type="button"
                            onClick={() => set(field, "")}
                            className="text-zinc-300 hover:text-red-500 transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors
                          ${busy
                            ? "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:border-blue-700"
                            : "border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
                          }`}>
                          {busy ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              <span>กำลังอัปโหลด...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>แนบไฟล์</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={!!uploadingDoc}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(field, f); e.target.value = "" }}
                          />
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )
        })()}

        {/* ── หมายเหตุ ── */}
        <Section title="หมายเหตุ">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="บันทึกหมายเหตุเพิ่มเติม..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700"
          />
        </Section>

        <div className="flex gap-3 pb-10">
          <Button type="submit" disabled={saving || !isAdmin} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "กำลังบันทึก..." : "บันทึกสัญญา"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
        </div>

        {/* ── Preview เอกสารสัญญา (อัปเดตทันทีตามที่กรอก) ── */}
        <div className="hidden xl:block flex-1 min-w-0 sticky top-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              ตัวอย่างเอกสารสัญญา — อัปเดตตามที่กรอกทันที
            </span>
            {missingDoc.length > 0 ? (
              <span className="text-[11px] font-semibold text-amber-600">
                ข้อมูลเอกสารยังขาดอีก {missingDoc.length} รายการ
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-600">
                ✓ ข้อมูลเอกสารครบถ้วน
              </span>
            )}
          </div>
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-950 p-4">
            <div style={{ zoom: 0.58 }}>
              <ContractDocument contract={previewContract} promo={previewPromo} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
