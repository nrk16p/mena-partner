"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Printer, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney, formatMonth, computePayroll, prevMonth as getPrevMonth } from "@/lib/utils"
import type { PayrollEntry } from "@/types"

type NumericFields = Omit<PayrollEntry, "_id"|"contractCode"|"month"|"totalIncome"|"totalDeductions"|"netPay"|"createdAt"|"updatedAt">

const INCOME_FIELDS: { key: keyof PayrollEntry; label: string }[] = [
  { key: "transportFee",     label: "ค่าขนส่ง" },
  { key: "ot",               label: "OT" },
  { key: "otherIncomeWHT",   label: "รับอื่นๆ (หักWHT)" },
  { key: "otherIncomeNoWHT", label: "รับอื่นๆ ไม่หักWHT" },
]

const DEDUCTION_FIELDS: { key: keyof PayrollEntry; label: string }[] = [
  { key: "fuel",                    label: "ค่าเชื้อเพลิง" },
  { key: "gps",                     label: "GPS" },
  { key: "repairInHouse",           label: "ค่าซ่อมแซม" },
  { key: "repairOutside",           label: "ซ่อมนอก" },
  { key: "mgmtFee8pct",             label: "ค่าดำเนินการ 8%" },
  { key: "labor",                   label: "ค่าแรง" },
  { key: "tire",                    label: "ค่ายาง" },
  { key: "tirePatch",               label: "ค่าปะยาง" },
  { key: "carWash",                 label: "ค่าทำความสะอาดรถ" },
  { key: "taxInsurance",            label: "ต่อภาษีและประกัน" },
  { key: "installment",             label: "ค่างวดรถ" },
  { key: "repairInstallment",       label: "ผ่อนชำระค่าซ่อม" },
  { key: "downPaymentInstallment",  label: "ผ่อนเงินดาวน์" },
]

const ZERO_ENTRY = Object.fromEntries(
  [...INCOME_FIELDS, ...DEDUCTION_FIELDS].map(({ key }) => [key, 0])
) as unknown as Omit<NumericFields, "workingDays" | "tripCount">

export default function PayrollEntryPage() {
  const { month, contractCode } = useParams<{ month: string; contractCode: string }>()
  const router = useRouter()
  const [form, setForm]     = useState<NumericFields & { workingDays: number; tripCount: number }>({
    workingDays: 0, tripCount: 0, ...ZERO_ENTRY,
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")
  const [isNew, setIsNew]     = useState(true)
  const [prevEntry, setPrevEntry] = useState<PayrollEntry | null>(null)

  useEffect(() => {
    fetch(`/api/payroll/${month}/${contractCode}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setForm(d)
          setIsNew(false)
        } else {
          fetch(`/api/trips?contractCode=${contractCode}&month=${month}`)
            .then((r) => r.ok ? r.json() : null)
            .then((trips: unknown[] | null) => {
              if (Array.isArray(trips) && trips.length > 0) {
                setForm((p) => ({ ...p, tripCount: trips.length }))
              }
            })
        }
      })

    // Load previous month for comparison
    fetch(`/api/payroll/${getPrevMonth(month)}/${contractCode}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPrevEntry(d) })
  }, [month, contractCode])

  const computed = computePayroll(form as Parameters<typeof computePayroll>[0])

  function numField(key: keyof typeof form) {
    return {
      value: String(form[key] ?? 0),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => ({ ...p, [key]: Number(e.target.value) })),
      type: "number" as const,
      min: "0",
      step: "0.01",
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const payload = { ...form, contractCode, month }
      const url     = `/api/payroll/${month}/${contractCode}`
      const res     = await fetch(url, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); return }
      router.push("/payroll")
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
            {isNew ? "กรอกเงินเดือน" : "แก้ไขเงินเดือน"}
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">{contractCode} · {formatMonth(month)}</p>
        </div>
        {!isNew && (
          <Link
            href={`/payroll/${month}/${contractCode}/print`}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2"
          >
            <Printer className="w-3.5 h-3.5" />
            ใบแจ้งเงินเดือน
          </Link>
        )}
      </div>

      {/* Previous month quick compare + copy */}
      {prevEntry && (
        <div className="mb-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">เดือนก่อนหน้า ({formatMonth(prevEntry.month)})</p>
            {isNew && (
              <button
                type="button"
                onClick={() => {
                  const { _id, month: _m, contractCode: _c, createdAt, updatedAt, totalIncome, totalDeductions, netPay, ...fields } = prevEntry
                  setForm((p) => ({ ...p, ...fields, tripCount: 0, transportFee: 0, ot: 0, otherIncomeWHT: 0, otherIncomeNoWHT: 0 }))
                }}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 border border-emerald-200 rounded px-2 py-0.5"
                title="คัดลอกรายการหักจากเดือนก่อน"
              >
                <Copy className="w-3 h-3" /> คัดลอกรายการหัก
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            {[
              { label: "รายรับ",   value: formatMoney(prevEntry.totalIncome),     color: "text-emerald-600" },
              { label: "รายหัก",   value: formatMoney(prevEntry.totalDeductions), color: "text-red-500" },
              { label: "สุทธิ",    value: formatMoney(prevEntry.netPay),          color: prevEntry.netPay < 0 ? "text-red-600" : "text-zinc-800 dark:text-zinc-100" },
              { label: "เที่ยว",   value: `${prevEntry.tripCount} เที่ยว`,       color: "" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
                <p className={`font-semibold text-xs ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Work summary */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-600 mb-4">ข้อมูลการทำงาน</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>วันทำงาน (วัน)</Label>
              <Input {...numField("workingDays")} />
            </div>
            <div className="space-y-1">
              <Label>จำนวนเที่ยว</Label>
              <Input {...numField("tripCount")} />
            </div>
          </div>
        </div>

        {/* Income */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-emerald-600 mb-4">รายการรับ</h2>
          <div className="grid grid-cols-2 gap-4">
            {INCOME_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input {...numField(key as keyof typeof form)} />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between text-sm">
            <span className="text-zinc-500">รวมรายรับ</span>
            <span className="font-bold text-emerald-600">{formatMoney(computed.totalIncome)} บาท</span>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-red-500 mb-4">รายการหัก</h2>
          <div className="grid grid-cols-2 gap-4">
            {DEDUCTION_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input {...numField(key as keyof typeof form)} />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex justify-between text-sm">
            <span className="text-zinc-500">รวมรายหัก</span>
            <span className="font-bold text-red-500">{formatMoney(computed.totalDeductions)} บาท</span>
          </div>
        </div>

        {/* Net Pay */}
        <div className="bg-zinc-800 dark:bg-zinc-700 rounded-xl px-6 py-5 flex items-center justify-between">
          <span className="text-white font-medium">เงินสุทธิ</span>
          <span className="text-2xl font-bold text-emerald-400">{formatMoney(computed.netPay)} บาท</span>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
    </div>
  )
}
