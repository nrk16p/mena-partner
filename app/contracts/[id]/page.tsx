"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Truck, ClipboardList, BarChart3, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatDate } from "@/lib/utils"
import type { Contract } from "@/types"

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

export default function ContractDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const isAdmin            = session?.user?.role === "admin"
  const [form, setForm]    = useState<Contract | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]  = useState("")

  useEffect(() => {
    fetch(`/api/contracts/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setForm(d) })
  }, [id])

  function strField(key: keyof Contract, type = "text", readOnly = false) {
    return {
      value: String(form?.[key] ?? ""),
      type,
      disabled: !isAdmin || readOnly,
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
      router.push("/contracts")
    } finally { setSaving(false) }
  }

  if (!form) return <div className="text-zinc-400 text-sm">กำลังโหลด...</div>

  const today = new Date().toISOString().slice(0, 10)
  const paid = form.totalPrice && form.downPayment && form.totalInstallments && form.monthlyInstallment
    ? form.downPayment + form.monthlyInstallment * form.totalInstallments
    : null

  return (
    <div className="max-w-2xl">
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
            <FileText className="w-3.5 h-3.5" /> เอกสารสัญญา (PDF)
          </Link>
        </div>
      </div>

      {/* Installment summary card */}
      {form.totalPrice > 0 && (
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
      {form.taxInsuranceTotalCost ? (
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
      {(form.insurer || isAdmin) && (
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
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">ข้อมูลสัญญา</h2>
          <div className="grid grid-cols-2 gap-4">
            {TEXT_FIELDS.map(({ key, label, type, readOnly }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input {...strField(key, type ?? "text", readOnly)} />
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

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1">ข้อมูลผู้ซื้อ / รถ (สำหรับเอกสารสัญญา)</h2>
          <p className="text-xs text-zinc-400 mb-4">กรอกให้ครบเพื่อให้เอกสารสัญญา (PDF) ไม่มีช่องว่างให้เติมมือ</p>
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

        {isAdmin && (
          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
          </div>
        )}
      </form>
    </div>
  )
}
