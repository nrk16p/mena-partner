"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Truck, ClipboardList, BarChart3, FileText, AlertTriangle, CheckCircle2 } from "lucide-react"
import { SearchCombobox } from "@/components/search-combobox"
import { missingDocFields, missingHireDocFields, missingGuaranteeDocFields, missingVendorDocFields } from "@/lib/contract-doc"
import { ContractDocument, PromotionAttachment, normPlate, type PromoMaster } from "@/components/contract-document"
import { HireContractDocument } from "@/components/hire-contract-document"
import { GuaranteeContractDocument } from "@/components/guarantee-contract-document"
import { VendorDocDocument } from "@/components/vendor-doc-document"
import { useDebounced } from "@/lib/use-debounced"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import type { Contract, Driver, Vehicle } from "@/types"

type FieldSpec = { key: keyof Contract; label: string; type?: string; readOnly?: boolean }

const TEXT_FIELDS: FieldSpec[] = [
  { key: "contractCode",  label: "รหัสสัญญา",         readOnly: true },
  { key: "contractDate",  label: "วันที่ทำสัญญา",      type: "date" },
  { key: "startDate",     label: "วันที่เริ่มต้น",      type: "date" },
  { key: "buyerName",     label: "ชื่อผู้เช่าซื้อ" },
  { key: "driverName",    label: "ชื่อผู้ขับขี่" },
  { key: "phone",         label: "เบอร์โทร",            type: "tel" },
  { key: "bankName",      label: "ธนาคาร" },
  { key: "accountNumber", label: "เลขที่บัญชี" },
  { key: "plant",         label: "แพล้นท์" },
  { key: "truckNumber",   label: "เบอร์รถ" },
  { key: "licensePlate",  label: "ทะเบียนรถ" },
  { key: "vehicleBrand",  label: "ยี่ห้อรถ" },
]

const NUM_FIELDS: FieldSpec[] = [
  { key: "totalPrice",          label: "ราคาขายรถ (บาท)" },
  { key: "downPayment",         label: "เงินดาวน์รวม (บาท)" },
  { key: "cashDown",            label: "เงินดาวน์ชำระแล้ว (บาท)" },
  { key: "remainingInstallment", label: "เงินดาวน์คงเหลือ (บาท)" },
  { key: "downInstallmentAmt",  label: "ค่างวดดาวน์/เดือน (บาท)" },
  { key: "downInstallmentCount", label: "จำนวนงวดดาวน์ (เดือน)" },
  { key: "financeAmount",       label: "ยอดเงินค่างวด (บาท)" },
  { key: "monthlyInstallment",  label: "ค่างวดรายเดือน (บาท)" },
  { key: "totalInstallments",   label: "จำนวนงวดรวม" },
]

// ข้อมูลเปิดเจ้าหนี้ — ใช้ในเอกสารเปิดเจ้าหนี้รายใหม่
const VENDOR_FIELDS: FieldSpec[] = [
  { key: "buyerNameEn",        label: "ชื่อเจ้าหนี้ (ภาษาอังกฤษ)" },
  { key: "email",              label: "Email ผู้ติดต่อ" },
  { key: "bankBranch",         label: "สาขาธนาคาร" },
  { key: "vendorCodeWinspeed", label: "รหัสเจ้าหนี้ Winspeed" },
  { key: "vendorCodeAtms",     label: "รหัสเจ้าหนี้ ATMS" },
]

// ผู้ค้ำประกัน — ใช้ในเอกสารสัญญาค้ำประกัน (เว้นว่างได้ถ้าไม่มีผู้ค้ำ)
const GUARANTOR_FIELDS: FieldSpec[] = [
  { key: "guarantorName",       label: "ชื่อ – นามสกุล ผู้ค้ำประกัน" },
  { key: "guarantorNationalId", label: "เลขบัตรประชาชนผู้ค้ำประกัน" },
  { key: "guarantorAddress",    label: "ที่อยู่ผู้ค้ำประกัน" },
]

// ข้อมูลที่ใช้ในเอกสารสัญญาซื้อขาย (PDF) — กรอกให้ครบเพื่อให้เอกสารไม่มีช่องว่าง
const DOC_FIELDS: FieldSpec[] = [
  { key: "birthDate",               label: "วันเกิดผู้ซื้อ (คำนวณอายุ)", type: "date" },
  { key: "nationalId",              label: "เลขบัตรประชาชนผู้ซื้อ" },
  { key: "driverAddress",           label: "ที่อยู่ผู้ซื้อ (เลขที่/หมู่/ตำบล/อำเภอ/จังหวัด)" },
  { key: "vehicleType",             label: "ประเภทรถ" },
  { key: "vehicleCharacteristic",   label: "ลักษณะ/มาตรฐาน" },
  { key: "vehicleModel",            label: "รุ่นรถ" },
  { key: "vehicleRegistrationDate", label: "วันจดทะเบียนรถ", type: "date" },
  { key: "vehicleColor",            label: "สีรถ" },
  { key: "chassisNumber",           label: "หมายเลขตัวรถ (ตัวถัง)" },
  { key: "engineNumber",            label: "หมายเลขเครื่องยนต์" },
  { key: "engineSize",              label: "ขนาดกำลังเครื่องยนต์" },
]

// ขั้นตอนแก้ไข — โครงเดียวกับหน้าเพิ่มสัญญา
const WIZARD_STEPS = [
  { title: "ข้อมูลหลัก",      desc: "สัญญา + ประกัน/ภาษี" },
  { title: "สัญญาซื้อขาย",    desc: "ผู้ซื้อ/รถ + การเงิน" },
  { title: "สัญญาค้ำประกัน",  desc: "ผู้ค้ำประกัน" },
  { title: "เปิดเจ้าหนี้",    desc: "ข้อมูลผู้ขาย/บัญชี" },
  { title: "สรุป & บันทึก",   desc: "หมายเหตุ + ตรวจสอบ" },
]

export default function ContractDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const isAdmin            = session?.user?.role === "admin"
  const [form, setForm]    = useState<Contract | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]  = useState(false)
  const [error, setError]  = useState("")
  const [promoList, setPromoList] = useState<PromoMaster[]>([])
  const [docTab, setDocTab] = useState<"sale" | "promo" | "hire" | "guarantee" | "vendor">("sale")
  const [step, setStep] = useState(0)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [pullDriverId, setPullDriverId] = useState("")
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [pullVehicleId, setPullVehicleId] = useState("")

  // เปลี่ยน step → สลับ preview ไปเอกสารที่เกี่ยวข้อง
  useEffect(() => {
    setDocTab(step === 2 ? "guarantee" : step === 3 ? "vendor" : "sale")
  }, [step])

  // คีย์ลัดโหลด PDF: กด 1–5 เปิดหน้าพิมพ์ (auto-print) — ข้ามเมื่อกำลังพิมพ์ในช่องกรอก
  useEffect(() => {
    const routes: Record<string, string> = {
      "1": "document", "2": "promotion-document", "3": "hire-document",
      "4": "guarantee-document", "5": "vendor-document",
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const el = document.activeElement as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return
      const route = routes[e.key]
      if (!route) return
      e.preventDefault()
      router.push(`/contracts/${id}/${route}?print=1`)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [id, router])

  // ทะเบียนพนักงาน (/drivers) + ทะเบียนรถ (/vehicles) — ใช้ดึงข้อมูลมาเติมในสัญญา
  useEffect(() => {
    fetch("/api/drivers?status=active")
      .then((r) => r.ok ? r.json() : [])
      .then(setDrivers)
    fetch("/api/vehicles")
      .then((r) => r.ok ? r.json() : [])
      .then(setVehicles)
  }, [])

  // merge ข้อมูลพนักงานเข้าฟอร์ม — overwrite=false เติมเฉพาะช่องที่ยังว่าง
  function mergeDriver(d: Driver, overwrite: boolean) {
    const pick = (master?: string, current?: string) =>
      overwrite ? (master || current || "") : (current || master || "")
    setForm((p) => p ? {
      ...p,
      driverId:      d._id ?? p.driverId,
      birthDate:     pick(d.birthDate,     p.birthDate),
      nationalId:    pick(d.nationalId,    p.nationalId),
      driverAddress: pick(d.address,       p.driverAddress),
      phone:         pick(d.phone,         p.phone),
      bankName:      pick(d.bankName,      p.bankName),
      accountNumber: pick(d.accountNumber, p.accountNumber),
    } : p)
  }

  // เดาพนักงานที่ตรงกับสัญญานี้ (driverId ก่อน แล้วค่อยเทียบชื่อ) → เติมช่องว่างให้อัตโนมัติ
  const buyerNameInForm = form?.buyerName ?? ""
  const driverIdInForm  = form?.driverId ?? ""
  useEffect(() => {
    if (!drivers.length || pullDriverId) return
    const match =
      (driverIdInForm && drivers.find((d) => d._id === driverIdInForm)) ||
      drivers.find((d) => `${d.firstName} ${d.lastName}`.trim() === buyerNameInForm.trim())
    if (match?._id) {
      setPullDriverId(match._id)
      mergeDriver(match, false)   // ดึงอัตโนมัติ: เติมเฉพาะช่องที่ยังว่าง
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, buyerNameInForm, driverIdInForm, pullDriverId])

  // merge ข้อมูลรถเข้าฟอร์ม — overwrite=false เติมเฉพาะช่องที่ยังว่าง
  function mergeVehicle(v: Vehicle, overwrite: boolean) {
    const pick = (master?: string, current?: string) =>
      overwrite ? (master || current || "") : (current || master || "")
    setForm((p) => p ? {
      ...p,
      vehicleId:               v._id ?? p.vehicleId,
      licensePlate:            pick(v.licensePlate,     p.licensePlate),
      truckNumber:             pick(v.truckNumber,      p.truckNumber),
      vehicleType:             pick(v.vehicleType,      p.vehicleType),
      vehicleCharacteristic:   pick(v.characteristic,   p.vehicleCharacteristic),
      vehicleBrand:            pick(v.brand,            p.vehicleBrand),
      vehicleModel:            pick(v.model,            p.vehicleModel),
      vehicleRegistrationDate: pick(v.registrationDate, p.vehicleRegistrationDate),
      vehicleColor:            pick(v.color,            p.vehicleColor),
      chassisNumber:           pick(v.chassisNumber,    p.chassisNumber),
      engineNumber:            pick(v.engineNumber,     p.engineNumber),
      engineSize:              pick(v.engineSize,       p.engineSize),
    } : p)
  }

  // เดารถที่ตรงกับสัญญานี้ (vehicleId ก่อน แล้วค่อยเทียบทะเบียน) → เติมช่องว่างให้อัตโนมัติ
  const plateInForm     = form?.licensePlate ?? ""
  const vehicleIdInForm = form?.vehicleId ?? ""
  useEffect(() => {
    if (!vehicles.length || pullVehicleId) return
    const match =
      (vehicleIdInForm && vehicles.find((v) => v._id === vehicleIdInForm)) ||
      vehicles.find((v) => (v.licensePlate ?? "").trim() === plateInForm.trim())
    if (match?._id) {
      setPullVehicleId(match._id)
      mergeVehicle(match, false)   // ดึงอัตโนมัติ: เติมเฉพาะช่องที่ยังว่าง
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, plateInForm, vehicleIdInForm, pullVehicleId])

  // เลือกพนักงาน/รถจาก combobox ในฟอร์ม → เติมข้อมูลทับทันที
  function handlePickDriver(d: Driver | null) {
    if (!d) {
      setPullDriverId("")
      setForm((p) => p ? { ...p, driverId: "", buyerName: "", driverName: "" } : p)
      return
    }
    if (d._id) setPullDriverId(d._id)
    const name = `${d.firstName} ${d.lastName}`.trim()
    setForm((p) => p ? { ...p, driverId: d._id ?? "", buyerName: name, driverName: name } : p)
    mergeDriver(d, true)
  }

  function handlePickVehicle(v: Vehicle | null) {
    if (!v) {
      setPullVehicleId("")
      setForm((p) => p ? { ...p, vehicleId: "", licensePlate: "" } : p)
      return
    }
    if (v._id) setPullVehicleId(v._id)
    mergeVehicle(v, true)
  }

  // ข้อมูลที่ยังขาดในตัว master เอง → ชี้ให้ไปแก้ที่ต้นทางได้เลย
  const pulledDriver  = drivers.find((d) => d._id === pullDriverId)
  const pulledVehicle = vehicles.find((v) => v._id === pullVehicleId)
  const driverMasterMissing = pulledDriver
    ? ([
        [!pulledDriver.birthDate,  "วันเกิด"],
        [!pulledDriver.nationalId, "เลขบัตรประชาชน"],
        [!pulledDriver.address,    "ที่อยู่"],
        [!pulledDriver.phone,      "เบอร์โทร"],
        [!(pulledDriver.bankName && pulledDriver.accountNumber), "บัญชีธนาคาร"],
      ] as [boolean, string][]).filter(([miss]) => miss).map(([, label]) => label)
    : []
  const vehicleMasterMissing = pulledVehicle
    ? ([
        [!pulledVehicle.vehicleType,      "ประเภทรถ"],
        [!pulledVehicle.characteristic,   "ลักษณะ"],
        [!pulledVehicle.brand,            "ยี่ห้อ"],
        [!pulledVehicle.model,            "รุ่น"],
        [!pulledVehicle.registrationDate, "วันจดทะเบียน"],
        [!pulledVehicle.color,            "สีรถ"],
        [!pulledVehicle.chassisNumber,    "เลขตัวถัง"],
        [!pulledVehicle.engineNumber,     "เลขเครื่อง"],
        [!pulledVehicle.engineSize,       "ขนาดเครื่องยนต์"],
      ] as [boolean, string][]).filter(([miss]) => miss).map(([, label]) => label)
    : []

  useEffect(() => {
    fetch(`/api/contracts/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setForm(d) })
    fetch("/api/promotions/master")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setPromoList(d))
  }, [id])

  // ทุกข้อมูลที่ปรากฏในเอกสารสัญญา = จำเป็นต้องกรอก → ไฮไลต์ช่องที่ยังขาด
  const missingDoc  = missingDocFields(form)
  // จำนวนข้อมูลที่ยังขาดของแต่ละเอกสาร — ใช้ในสรุปขั้นตอนสุดท้าย
  const missCounts = {
    sale:      missingDocFields(form).length,
    // แนบท้ายโปรโมชั่น: นับจาก promotion_master (ไม่มี record = ขาด 3, มี = นับ pro1/2/3 ที่ว่าง)
    promo:     (() => {
      const mp = promoList.find((p) => normPlate(p.licensePlate) === normPlate(form?.licensePlate ?? "")) ?? null
      return mp ? [mp.pro1TotalValue, mp.pro2RepairBudget, mp.pro3AnnualPm].filter((v) => v == null).length : 3
    })(),
    hire:      missingHireDocFields(form).length,
    guarantee: missingGuaranteeDocFields(form).length,
    vendor:    missingVendorDocFields(form).length,
  }
  const missingKeys = new Set(missingDoc.map((f) => f.key))
  const missingCls = (key: keyof Contract) =>
    missingKeys.has(key)
      ? "border-amber-400 ring-1 ring-amber-300 bg-amber-50 dark:bg-amber-950/30 placeholder:text-amber-400"
      : ""

  function strField(key: keyof Contract, type = "text", readOnly = false) {
    return {
      value: String(form?.[key] ?? ""),
      type,
      disabled: !isAdmin || readOnly,
      className: missingCls(key),
      placeholder: missingKeys.has(key) ? "จำเป็นต้องกรอก" : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => p ? { ...p, [key]: e.target.value } : p),
    }
  }

  function numField(key: keyof Contract) {
    return {
      value: String(form?.[key] ?? 0),
      type: "number",
      min: "0",
      disabled: !isAdmin,
      className: missingCls(key),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => p ? { ...p, [key]: Number(e.target.value) } : p),
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !isAdmin) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); return }
      // อยู่หน้าเดิมหลังบันทึก — โชว์สถานะ "บันทึกแล้ว" ชั่วครู่แทนการเด้งกลับหน้ารายการ
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  // debounce เอกสาร A4 ในพรีวิว — พิมพ์แล้วไม่ re-render ทุกตัวอักษร
  // ต้องเรียก hook ก่อน early-return เสมอ (Rules of Hooks): ถ้าเรียกหลัง `if (!form) return`
  // จำนวน hook จะไม่คงที่ระหว่าง render (form: null → โหลดเสร็จ) → React crash ทั้งหน้า
  const debouncedForm = useDebounced(form, 200)

  if (!form) return <div className="text-zinc-400 text-sm">กำลังโหลด...</div>

  // ผ่าน guard แล้ว form ไม่เป็น null; debounce อาจ lag ชั่วครู่ตอนโหลดครั้งแรก → fallback เป็น form
  const previewData = debouncedForm ?? form

  const today = new Date().toISOString().slice(0, 10)
  const paid = form.totalPrice && form.downPayment && form.totalInstallments && form.monthlyInstallment
    ? form.downPayment + form.monthlyInstallment * form.totalInstallments
    : null

  return (
    <div className="max-w-[1500px]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">สัญญา {form.contractCode}</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{form.buyerName} · {form.licensePlate}</p>
        <div className="flex gap-2 mt-3">
          <Link
            href={`/trips?q=${encodeURIComponent(form.contractCode)}`}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5"
          >
            <Truck className="w-3.5 h-3.5" /> รายเที่ยว
          </Link>
          <Link
            href={`/payroll?q=${encodeURIComponent(form.contractCode)}`}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" /> ประวัติเงินเดือน
          </Link>
          <Link
            href={`/promotions/${form.contractCode}`}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" /> โปรโมชั่น
          </Link>
          <Link
            href={`/contracts/${id}/document`}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> สัญญาซื้อขาย (PDF)
            <kbd className="ml-1 text-[9px] font-mono leading-none px-1 py-0.5 rounded bg-white/80 border border-emerald-300 text-emerald-700">1</kbd>
          </Link>
          <Link
            href={`/contracts/${id}/promotion-document`}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> เอกสารแนบท้าย (PDF)
            <kbd className="ml-1 text-[9px] font-mono leading-none px-1 py-0.5 rounded bg-white/80 border border-emerald-300 text-emerald-700">2</kbd>
          </Link>
          <Link
            href={`/contracts/${id}/hire-document`}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> สัญญาว่าจ้าง (PDF)
            <kbd className="ml-1 text-[9px] font-mono leading-none px-1 py-0.5 rounded bg-white/80 border border-emerald-300 text-emerald-700">3</kbd>
          </Link>
          <Link
            href={`/contracts/${id}/guarantee-document`}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> สัญญาค้ำประกัน (PDF)
            <kbd className="ml-1 text-[9px] font-mono leading-none px-1 py-0.5 rounded bg-white/80 border border-emerald-300 text-emerald-700">4</kbd>
          </Link>
          <Link
            href={`/contracts/${id}/vendor-document`}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> เปิดเจ้าหนี้ (PDF)
            <kbd className="ml-1 text-[9px] font-mono leading-none px-1 py-0.5 rounded bg-white/80 border border-emerald-300 text-emerald-700">5</kbd>
          </Link>
        </div>
      </div>

      {/* ความครบถ้วนของข้อมูลเอกสารสัญญา — ทุกช่องในสัญญาจำเป็นต้องกรอก */}
      {missingDoc.length > 0 ? (
        <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            ข้อมูลเอกสารสัญญายังไม่ครบ — ขาดอีก {missingDoc.length} รายการ (ทุกข้อมูลในสัญญาจำเป็นต้องกรอก)
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {missingDoc.map((f) => (
              <span key={f.key} className="text-[11px] font-medium bg-white dark:bg-zinc-900 text-amber-800 dark:text-amber-300 border border-amber-300 rounded-full px-2.5 py-0.5">
                {f.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
            ช่องที่ต้องกรอกถูกไฮไลต์เป็นสีเหลืองในฟอร์มด้านล่าง — กรอกแล้วกดบันทึก
          </p>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4" /> ข้อมูลเอกสารสัญญาครบถ้วน — พร้อมออกเอกสารจริง
        </div>
      )}

      {/* ── ซ้าย: ฟอร์ม | ขวา: preview สัญญาสด ── */}
      <div className="flex gap-6 items-start">
        <div className="w-full xl:max-w-2xl min-w-0 shrink-0 xl:w-[42rem]">

      {/* ── Stepper: 4 ขั้นตอนตามเอกสารสัญญา ── */}
      <div className="mb-6 flex items-center">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s.title} className={`flex items-center ${i < WIZARD_STEPS.length - 1 ? "flex-1" : ""}`}>
            <button type="button" onClick={() => setStep(i)} className="flex items-center gap-2 group">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                i === step
                  ? "bg-emerald-600 text-white"
                  : i < step
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
              }`}>
                {i < step ? "✓" : i + 1}
              </span>
              <span className="text-left hidden sm:block">
                <span className={`block text-xs font-semibold leading-tight ${
                  i === step ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400"
                }`}>{s.title}</span>
                <span className="block text-[10px] text-zinc-400 leading-tight">{s.desc}</span>
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${i < step ? "bg-emerald-300 dark:bg-emerald-800" : "bg-zinc-200 dark:bg-zinc-700"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Installment summary card */}
      {step === 0 && form.totalPrice > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1">ราคาขาย</p>
              <p className="text-lg font-bold">{formatMoney(form.totalPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">งวดละ / จำนวนงวด</p>
              <p className="text-lg font-bold">{formatMoney(form.monthlyInstallment)} <span className="text-sm font-normal text-zinc-400">× {form.totalInstallments} งวด</span></p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">รวมที่ต้องชำระ</p>
              <p className="text-lg font-bold text-emerald-600">{paid ? formatMoney(paid) : "-"}</p>
            </div>
          </div>
          {/* Estimated remaining balance */}
          {form.startDate && form.monthlyInstallment > 0 && form.totalInstallments > 0 && (() => {
            const start = new Date(form.startDate)
            const now = new Date()
            const monthsPassed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
            const monthsPaid = Math.min(monthsPassed, form.totalInstallments)
            const remaining = form.totalInstallments - monthsPaid
            const remainingAmt = remaining * form.monthlyInstallment
            const pct = Math.round((monthsPaid / form.totalInstallments) * 100)
            return (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                  <span>ผ่อนไปแล้ว {monthsPaid}/{form.totalInstallments} งวด ({pct}%)</span>
                  <span>คงเหลือ <span className="font-semibold text-zinc-700 dark:text-zinc-300">{remaining} งวด · {formatMoney(remainingAmt)} บาท</span></span>
                </div>
                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Tax/Insurance cost summary — seeded from Excel, read-only */}
      {step === 0 && form.taxInsuranceTotalCost ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">ค่าใช้จ่าย ภาษี + ประกัน + พรบ</h2>
            <span className="text-xs text-zinc-400">{form.insuranceCompany ?? ""}</span>
          </div>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {([
              ["ประกันภัย", form.insuranceAmount],
              ["พรบ", form.prbAmount],
              ["ภาษีทะเบียน", form.taxAmount],
              ["ตรวจสภาพ", form.inspectionCost],
              ["รวมทั้งสิ้น", form.taxInsuranceTotalCost],
            ] as [string, number | undefined][]).map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-zinc-400 mb-1">{label}</p>
                <p className={`text-sm font-semibold ${label === "รวมทั้งสิ้น" ? "text-emerald-600" : ""}`}>{val ? formatMoney(val) : "-"}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
            <div><span className="text-zinc-400">จ่าย </span>{form.taxInstallmentCount ?? 0} งวด × {formatMoney(form.taxMonthlyInstallment ?? 0)}/เดือน</div>
            <div><span className="text-zinc-400">ต่อภาษี </span>{formatDate(form.taxRenewalDate)}</div>
            <div><span className="text-zinc-400">คงเหลือ </span><span className="text-zinc-700 font-medium">{formatMoney(form.taxBalanceRemaining ?? 0)}</span></div>
          </div>
        </div>
      ) : null}

      {/* Insurance info card — editable for admins */}
      {step === 0 && (form.insurer || isAdmin) && (
        <div className={`bg-white dark:bg-zinc-900 rounded-xl border p-5 mb-6 ${
          form.taxExpiryDate && form.taxExpiryDate < today
            ? "border-red-300 dark:border-red-800"
            : "border-zinc-200 dark:border-zinc-800"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">ข้อมูลประกันภัย / ภาษี</h2>
            {form.taxExpiryDate && form.taxExpiryDate < today && (
              <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">หมดอายุแล้ว</span>
            )}
          </div>
          {isAdmin ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">บริษัทประกัน</Label>
                <Input
                  value={String(form.insurer ?? "")}
                  onChange={(e) => setForm((p) => p ? { ...p, insurer: e.target.value } : p)}
                  placeholder="ชื่อบริษัทประกัน"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ค่าประกัน/ภาษี ต่อเดือน (บาท)</Label>
                <Input
                  type="number" min="0"
                  value={String(form.monthlyInsuranceFee ?? 0)}
                  onChange={(e) => setForm((p) => p ? { ...p, monthlyInsuranceFee: Number(e.target.value) } : p)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">วันต่อล่าสุด</Label>
                <Input
                  type="date"
                  value={String(form.taxRenewalDate ?? "")}
                  onChange={(e) => setForm((p) => p ? { ...p, taxRenewalDate: e.target.value } : p)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">วันหมดอายุ</Label>
                <Input
                  type="date"
                  value={String(form.taxExpiryDate ?? "")}
                  onChange={(e) => setForm((p) => p ? { ...p, taxExpiryDate: e.target.value } : p)}
                  className={form.taxExpiryDate && form.taxExpiryDate < today ? "border-red-400 text-red-600" : ""}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">เบี้ยประกันภัย (บาท)</Label>
                <Input
                  type="number" min="0"
                  value={String(form.insuranceAmount ?? 0)}
                  onChange={(e) => setForm((p) => p ? { ...p, insuranceAmount: Number(e.target.value) } : p)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">เบี้ย พรบ (บาท)</Label>
                <Input
                  type="number" min="0"
                  value={String(form.prbAmount ?? 0)}
                  onChange={(e) => setForm((p) => p ? { ...p, prbAmount: Number(e.target.value) } : p)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ค่าภาษีทะเบียน (บาท)</Label>
                <Input
                  type="number" min="0"
                  value={String(form.taxAmount ?? 0)}
                  onChange={(e) => setForm((p) => p ? { ...p, taxAmount: Number(e.target.value) } : p)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-zinc-400 mb-1">บริษัทประกัน</p>
                <p className="text-sm font-medium">{form.insurer || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">วันต่อล่าสุด</p>
                <p className="text-sm font-medium">{formatDate(form.taxRenewalDate)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">วันหมดอายุ</p>
                <p className={`text-sm font-medium ${form.taxExpiryDate && form.taxExpiryDate < today ? "text-red-600" : ""}`}>
                  {formatDate(form.taxExpiryDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">ค่างวดต่อเดือน</p>
                <p className="text-sm font-medium">{form.monthlyInsuranceFee ? formatMoney(form.monthlyInsuranceFee) : "-"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {step === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">ข้อมูลสัญญา</h2>
          <div className="grid grid-cols-2 gap-4">
            {TEXT_FIELDS.map(({ key, label, type, readOnly }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                {key === "buyerName" && isAdmin ? (
                  <>
                    <SearchCombobox<Driver>
                      items={drivers}
                      selected={
                        pulledDriver ??
                        (form.buyerName
                          ? ({ _id: "__current__", firstName: form.buyerName, lastName: "", status: "active" } as Driver)
                          : null)
                      }
                      onSelect={handlePickDriver}
                      getLabel={(d) => `${d.firstName} ${d.lastName}`.trim()}
                      getSub={(d) => d.staffCode ?? ""}
                      placeholder="พิมพ์ชื่อ นามสกุล หรือรหัสพนักงาน..."
                      searchKeys={(d) => [d.firstName, d.lastName, d.staffCode ?? "", d.nationalId ?? "", d.phone ?? ""]}
                    />
                    {pulledDriver && driverMasterMissing.length > 0 && (
                      <Link
                        href={`/drivers/${pullDriverId}`}
                        target="_blank"
                        className="flex items-start gap-1 text-[10px] text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                        <span>ทะเบียนพนักงานยังขาด: {driverMasterMissing.join(", ")} — คลิกไปกรอก →</span>
                      </Link>
                    )}
                  </>
                ) : key === "licensePlate" && isAdmin ? (
                  <>
                    <SearchCombobox<Vehicle>
                      items={vehicles}
                      selected={
                        pulledVehicle ??
                        (form.licensePlate
                          ? ({ _id: "__current__", licensePlate: form.licensePlate } as Vehicle)
                          : null)
                      }
                      onSelect={handlePickVehicle}
                      getLabel={(v) => v.licensePlate ?? ""}
                      getSub={(v) => [v.truckNumber, v.brand].filter(Boolean).join(" · ")}
                      placeholder="พิมพ์ทะเบียน เบอร์รถ หรือยี่ห้อ..."
                      searchKeys={(v) => [v.licensePlate ?? "", v.truckNumber ?? "", v.brand ?? "", v.model ?? "", v.chassisNumber ?? ""]}
                    />
                    {pulledVehicle && vehicleMasterMissing.length > 0 && (
                      <Link
                        href={`/vehicles?edit=${pullVehicleId}`}
                        target="_blank"
                        className="flex items-start gap-1 text-[10px] text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                        <span>ทะเบียนรถยังขาด: {vehicleMasterMissing.join(", ")} — คลิกไปกรอก →</span>
                      </Link>
                    )}
                  </>
                ) : (
                  <Input {...strField(key, type ?? "text", readOnly)} />
                )}
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">สถานะ</Label>
              <select
                value={String(form.status ?? "active")}
                disabled={!isAdmin}
                onChange={(e) => setForm((p) => p ? { ...p, status: e.target.value as Contract["status"] } : p)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50"
              >
                <option value="active">ใช้งาน</option>
                <option value="completed">สิ้นสุด</option>
                <option value="terminated">ยกเลิก</option>
              </select>
            </div>
          </div>
        </div>
        )}

        {step === 3 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">ข้อมูลเปิดเจ้าหนี้ (สำหรับเอกสารเปิดเจ้าหนี้รายใหม่)</h2>
          <p className="text-xs text-zinc-400 mb-4">ประเภทบัญชี + สาขาธนาคาร จำเป็นสำหรับแบบฟอร์มลงทะเบียนผู้ขาย — รหัสเจ้าหนี้เว้นว่างได้ (บัญชีกำหนดหลังเปิด)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">ประเภทบัญชี</Label>
              <select
                value={String(form.bankAccountType ?? "")}
                disabled={!isAdmin}
                onChange={(e) => setForm((p) => p ? { ...p, bankAccountType: e.target.value } : p)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50"
              >
                <option value="">— เลือก —</option>
                <option value="ออมทรัพย์">ออมทรัพย์</option>
                <option value="กระแสรายวัน">กระแสรายวัน</option>
                <option value="ประจำ">ประจำ</option>
              </select>
            </div>
            {VENDOR_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input {...strField(key)} />
              </div>
            ))}
          </div>
        </div>
        )}

        {step === 1 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">ข้อมูลผู้ซื้อ / รถ (สำหรับเอกสารสัญญา)</h2>
          <p className="text-xs text-zinc-400 mb-4">กรอกให้ครบเพื่อให้เอกสารสัญญา (PDF) ไม่มีช่องว่างให้เติมมือ</p>

          {/* เลือกพนักงาน/ทะเบียนรถได้จากช่อง "ชื่อผู้เช่าซื้อ" และ "ทะเบียนรถ" ใน ข้อมูลสัญญา (ขั้นตอนที่ 1) */}
          <div className="grid grid-cols-2 gap-4">
            {DOC_FIELDS.map(({ key, label, type, readOnly }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input {...strField(key, type ?? "text", readOnly)} />
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">ระยะทางที่ใช้แล้ว (กม.)</Label>
              <Input {...numField("mileage")} />
            </div>
          </div>
        </div>
        )}

        {step === 2 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">ผู้ค้ำประกัน (สำหรับสัญญาค้ำประกัน)</h2>
          <p className="text-xs text-zinc-400 mb-4">เว้นว่างได้ถ้าไม่มีผู้ค้ำประกัน — เอกสารจะพิมพ์เป็นเส้นประให้เติมมือ</p>
          <div className="grid grid-cols-2 gap-4">
            {GUARANTOR_FIELDS.map(({ key, label }) => (
              <div key={key} className={`space-y-1 ${key === "guarantorAddress" ? "col-span-2" : ""}`}>
                <Label className="text-xs">{label}</Label>
                <Input {...strField(key)} />
              </div>
            ))}
          </div>
        </div>
        )}

        {step === 1 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">ข้อมูลการเงิน</h2>
          <div className="grid grid-cols-2 gap-4">
            {NUM_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input {...numField(key)} />
              </div>
            ))}
          </div>
        </div>
        )}

        {step === 4 && (<>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">หมายเหตุ</h2>
          <textarea
            value={String(form.notes ?? "")}
            disabled={!isAdmin}
            onChange={(e) => setForm((p) => p ? { ...p, notes: e.target.value } : p)}
            rows={4}
            placeholder="บันทึกหมายเหตุเพิ่มเติม..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y disabled:opacity-50 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* ── สรุปความครบถ้วนของเอกสารทั้ง 3 ฉบับ ── */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">ความครบถ้วนของเอกสาร</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {([
              { key: "sale",      label: "สัญญาซื้อขาย",   href: `/contracts/${id}/document` },
              { key: "promo",     label: "แนบท้ายโปรโมชั่น", href: `/contracts/${id}/promotion-document` },
              { key: "hire",      label: "สัญญาว่าจ้าง",   href: `/contracts/${id}/hire-document` },
              { key: "guarantee", label: "สัญญาค้ำประกัน", href: `/contracts/${id}/guarantee-document` },
              { key: "vendor",    label: "เปิดเจ้าหนี้",   href: `/contracts/${id}/vendor-document` },
            ] as const).map(({ key, label, href }) => {
              const miss = missCounts[key]
              return (
                <div
                  key={key}
                  className={`rounded-lg border px-3 py-2.5 ${
                    miss === 0
                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                  }`}
                >
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{label}</div>
                  <div className={`text-[11px] font-semibold mt-0.5 ${miss === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {miss === 0 ? "✓ ข้อมูลครบ" : `ขาด ${miss} รายการ`}
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <button type="button" onClick={() => setDocTab(key)} className="text-[10px] text-zinc-500 underline hover:text-zinc-700">
                      ดูตัวอย่าง
                    </button>
                    <Link href={href} className="text-[10px] text-emerald-600 underline hover:text-emerald-700">
                      พิมพ์ PDF
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        </>)}

        <div className="flex gap-3 items-center">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              ← ย้อนกลับ
            </Button>
          )}
          {step < WIZARD_STEPS.length - 1 && (
            <Button type="button" onClick={() => setStep(step + 1)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              ถัดไป: {WIZARD_STEPS[step + 1].title} →
            </Button>
          )}
          {isAdmin && (
            <Button
              type="submit"
              disabled={saving}
              className={step === WIZARD_STEPS.length - 1
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : ""}
              variant={step === WIZARD_STEPS.length - 1 ? "default" : "outline"}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> บันทึกแล้ว
            </span>
          )}
        </div>
      </form>
        </div>

        {/* ── Preview เอกสารสัญญา (อัปเดตทันทีตามที่กรอก) ── */}
        <div className="hidden xl:block flex-1 min-w-0 sticky top-4">
          <div className="flex items-center justify-between mb-2 gap-3">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              {([
                { key: "sale", label: "สัญญาซื้อขาย" },
                { key: "promo", label: "แนบท้ายโปรโมชั่น" },
                { key: "hire", label: "สัญญาว่าจ้าง" },
                { key: "guarantee", label: "สัญญาค้ำประกัน" },
                { key: "vendor", label: "เปิดเจ้าหนี้" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDocTab(key)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    docTab === key
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link
              href={`/contracts/${id}/${docTab === "sale" ? "document" : docTab === "promo" ? "promotion-document" : docTab === "hire" ? "hire-document" : docTab === "guarantee" ? "guarantee-document" : "vendor-document"}`}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline whitespace-nowrap"
            >
              เปิดหน้าพิมพ์ / PDF →
            </Link>
          </div>
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-950 p-4">
            <div style={{ zoom: 0.58 }}>
              {docTab === "sale" ? (
                <ContractDocument contract={previewData} />
              ) : docTab === "promo" ? (
                <PromotionAttachment
                  contract={previewData}
                  promo={promoList.find((p) => normPlate(p.licensePlate) === normPlate(previewData.licensePlate)) ?? null}
                />
              ) : docTab === "hire" ? (
                <HireContractDocument contract={previewData} />
              ) : docTab === "guarantee" ? (
                <GuaranteeContractDocument contract={previewData} />
              ) : (
                <VendorDocDocument contract={previewData} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
