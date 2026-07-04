"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Printer } from "lucide-react"
import { formatMoney, formatMonth } from "@/lib/utils"
import type { PayrollEntry, Driver, Contract } from "@/types"

const INCOME_FIELDS: { key: keyof PayrollEntry; label: string }[] = [
  { key: "transportFee",     label: "ค่าขนส่ง" },
  { key: "ot",               label: "OT" },
  { key: "otherIncomeWHT",   label: "รับอื่นๆ (หักภาษี ณ ที่จ่าย)" },
  { key: "otherIncomeNoWHT", label: "รับอื่นๆ (ไม่หักภาษี)" },
]

const DEDUCTION_FIELDS: { key: keyof PayrollEntry; label: string }[] = [
  { key: "fuel",                   label: "ค่าเชื้อเพลิง" },
  { key: "gps",                    label: "GPS" },
  { key: "repairInHouse",          label: "ค่าซ่อมแซม (ใน)" },
  { key: "repairOutside",          label: "ค่าซ่อมแซม (นอก)" },
  { key: "mgmtFee8pct",            label: "ค่าดำเนินการ 8%" },
  { key: "labor",                  label: "ค่าแรง" },
  { key: "tire",                   label: "ค่ายาง" },
  { key: "tirePatch",              label: "ค่าปะยาง" },
  { key: "carWash",                label: "ค่าทำความสะอาดรถ" },
  { key: "taxInsurance",           label: "ต่อภาษีและประกัน" },
  { key: "installment",            label: "ค่างวดรถ" },
  { key: "repairInstallment",      label: "ผ่อนชำระค่าซ่อม" },
  { key: "downPaymentInstallment", label: "ผ่อนเงินดาวน์" },
]

export default function PrintPayslipPage() {
  const { month, contractCode } = useParams<{ month: string; contractCode: string }>()
  const [entry, setEntry]       = useState<PayrollEntry | null>(null)
  const [driver, setDriver]     = useState<Driver | null>(null)
  const [contract, setContract] = useState<Contract | null>(null)
  const [tripCount, setTripCount] = useState(0)

  useEffect(() => {
    fetch(`/api/payroll/${month}/${contractCode}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setEntry(d) })

    fetch(`/api/drivers?q=${encodeURIComponent(contractCode)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((ds: Driver[]) => {
        const found = ds.find((d) => d.contractCode === contractCode)
        if (found) setDriver(found)
      })

    fetch(`/api/contracts?q=${encodeURIComponent(contractCode)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((cs: Contract[]) => {
        const found = cs.find((c) => c.contractCode === contractCode)
        if (found) setContract(found)
      })

    fetch(`/api/trips?contractCode=${contractCode}&month=${month}`)
      .then((r) => r.ok ? r.json() : [])
      .then((ts: unknown[]) => setTripCount(Array.isArray(ts) ? ts.length : 0))
  }, [month, contractCode])

  if (!entry) {
    return <div className="p-8 text-sm text-zinc-400">กำลังโหลด...</div>
  }

  const numVal = (key: keyof PayrollEntry) => {
    const v = entry[key]
    return typeof v === "number" ? v : 0
  }

  const incomeRows = INCOME_FIELDS.filter((f) => numVal(f.key) !== 0)
  const deductRows = DEDUCTION_FIELDS.filter((f) => numVal(f.key) !== 0)

  return (
    <div>
      {/* Print button — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          <Printer className="w-4 h-4" />
          พิมพ์ใบแจ้งเงินเดือน
        </button>
        <button
          onClick={() => window.history.back()}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← กลับ
        </button>
      </div>

      {/* Payslip — styled for print */}
      <div className="print-page bg-white max-w-[210mm] mx-auto p-10 shadow-md print:shadow-none print:p-8">
        {/* Header */}
        <div className="border-b-2 border-zinc-800 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-wide">บริษัท เมน่า ทรานสปอร์ต จำกัด</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Mena Transport Co., Ltd.</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">ใบแจ้งเงินเดือน</p>
              <p className="text-xs text-zinc-500">Payslip</p>
            </div>
          </div>
        </div>

        {/* Employee info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
          <Row label="เดือน"          value={formatMonth(month)} bold />
          <Row label="รหัสสัญญา"      value={contractCode} bold />
          <Row label="ชื่อผู้ขับขี่"   value={driver?.driverName ?? contract?.driverName ?? "-"} />
          <Row label="ชื่อผู้เช่าซื้อ"  value={driver?.buyerName  ?? contract?.buyerName  ?? "-"} />
          <Row label="ทะเบียนรถ"      value={driver?.licensePlate ?? contract?.licensePlate ?? "-"} />
          <Row label="แพล้นท์"         value={contract?.plant ?? "-"} />
          <Row label="วันทำงาน"       value={`${entry.workingDays} วัน`} />
          <Row label="จำนวนเที่ยว"    value={`${tripCount || entry.tripCount} เที่ยว`} />
        </div>

        {/* Income / Deductions table */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Income */}
          <div>
            <div className="bg-zinc-100 px-3 py-1.5 rounded-t text-xs font-semibold text-zinc-700 uppercase tracking-wide">
              รายการรับ
            </div>
            <table className="w-full text-sm border border-zinc-200 rounded-b overflow-hidden">
              <tbody className="divide-y divide-zinc-100">
                {incomeRows.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="px-3 py-1.5 text-zinc-600">{label}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatMoney(numVal(key))}</td>
                  </tr>
                ))}
                {incomeRows.length === 0 && (
                  <tr><td colSpan={2} className="px-3 py-2 text-zinc-400 text-xs text-center">ไม่มีรายการ</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-semibold text-emerald-700">
                  <td className="px-3 py-2 text-sm">รวมรายรับ</td>
                  <td className="px-3 py-2 text-right text-sm">{formatMoney(entry.totalIncome)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions */}
          <div>
            <div className="bg-zinc-100 px-3 py-1.5 rounded-t text-xs font-semibold text-zinc-700 uppercase tracking-wide">
              รายการหัก
            </div>
            <table className="w-full text-sm border border-zinc-200 rounded-b overflow-hidden">
              <tbody className="divide-y divide-zinc-100">
                {deductRows.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="px-3 py-1.5 text-zinc-600">{label}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(numVal(key))}</td>
                  </tr>
                ))}
                {deductRows.length === 0 && (
                  <tr><td colSpan={2} className="px-3 py-2 text-zinc-400 text-xs text-center">ไม่มีรายการ</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-red-50 font-semibold text-red-600">
                  <td className="px-3 py-2 text-sm">รวมรายหัก</td>
                  <td className="px-3 py-2 text-right text-sm">{formatMoney(entry.totalDeductions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Net pay */}
        <div className="border-2 border-zinc-800 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">เงินได้สุทธิ / Net Pay</p>
            <p className="text-sm text-zinc-500 mt-0.5">{contractCode} · {formatMonth(month)}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${entry.netPay < 0 ? "text-red-600" : "text-zinc-900"}`}>
              {formatMoney(entry.netPay)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">บาท / THB</p>
          </div>
        </div>

        {/* Signature area */}
        <div className="grid grid-cols-2 gap-8 mt-10 text-xs text-zinc-400">
          <div className="text-center">
            <div className="border-b border-zinc-300 mb-1 pb-6" />
            <p>ผู้รับเงิน / Recipient</p>
          </div>
          <div className="text-center">
            <div className="border-b border-zinc-300 mb-1 pb-6" />
            <p>ผู้จ่ายเงิน / Payer</p>
          </div>
        </div>

        <p className="text-[10px] text-zinc-300 mt-6 text-center print:text-zinc-400">
          พิมพ์โดยระบบ Mena Partner · {new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .print-page { max-width: 100%; box-shadow: none; }
        }
        @page { margin: 10mm; size: A4; }
      `}</style>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-zinc-400 w-28 shrink-0">{label}:</span>
      <span className={bold ? "font-semibold" : "font-normal"}>{value}</span>
    </div>
  )
}
