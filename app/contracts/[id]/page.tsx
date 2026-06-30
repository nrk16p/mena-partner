"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/utils"
import type { Contract } from "@/types"

type FieldSpec = { key: keyof Contract; label: string; type?: string; readOnly?: boolean }

const TEXT_FIELDS: FieldSpec[] = [
  { key: "contractCode",  label: "รหัสสัญญา",         readOnly: true },
  { key: "contractDate",  label: "วันที่ทำสัญญา",      type: "date" },
  { key: "startDate",     label: "วันที่เริ่มต้น",      type: "date" },
  { key: "buyerName",     label: "ชื่อผู้เช่าซื้อ" },
  { key: "driverName",    label: "ชื่อผู้ขับขี่" },
  { key: "phone",         label: "เบอร์โทร",            type: "tel" },
  { key: "accountNumber", label: "เลขที่บัญชี" },
  { key: "plant",         label: "แพล้นท์" },
  { key: "truckNumber",   label: "เบอร์รถ" },
  { key: "licensePlate",  label: "ทะเบียนรถ" },
  { key: "vehicleBrand",  label: "ยี่ห้อรถ" },
]

const NUM_FIELDS: FieldSpec[] = [
  { key: "totalPrice",          label: "ราคาขายรถ (บาท)" },
  { key: "downPayment",         label: "เงินดาวน์ (บาท)" },
  { key: "monthlyInstallment",  label: "ค่างวดรายเดือน (บาท)" },
  { key: "totalInstallments",   label: "จำนวนงวดรวม" },
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

  const paid = form.totalPrice && form.downPayment && form.totalInstallments && form.monthlyInstallment
    ? form.downPayment + form.monthlyInstallment * form.totalInstallments
    : null

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">สัญญา {form.contractCode}</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{form.buyerName} · {form.licensePlate}</p>
      </div>

      {/* Installment summary card */}
      {form.totalPrice > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 mb-6 grid grid-cols-3 gap-4">
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
      )}

      {/* Insurance info card (read-only) */}
      {form.insurer && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 mb-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">ข้อมูลประกันภัย / ภาษี</h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1">บริษัทประกัน</p>
              <p className="text-sm font-medium">{form.insurer}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">วันต่อล่าสุด</p>
              <p className="text-sm font-medium">{form.taxRenewalDate ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">วันหมดอายุ</p>
              <p className={`text-sm font-medium ${form.taxExpiryDate && form.taxExpiryDate < new Date().toISOString().slice(0,10) ? "text-red-600" : ""}`}>
                {form.taxExpiryDate ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">ค่างวดต่อเดือน</p>
              <p className="text-sm font-medium">{form.monthlyInsuranceFee ? formatMoney(form.monthlyInsuranceFee) : "-"}</p>
            </div>
          </div>
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
