"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Printer } from "lucide-react"
import { formatMoney, formatMonth } from "@/lib/utils"

type Row = {
  contractCode: string
  driverName: string
  truckNumber: string
  plant: string
  tripCount: number
  workingDays: number
  transportFee: number
  ot: number
  otherIncomeWHT: number
  otherIncomeNoWHT: number
  fuel: number
  gps: number
  repairInHouse: number
  repairOutside: number
  mgmtFee8pct: number
  labor: number
  tire: number
  tirePatch: number
  carWash: number
  taxInsurance: number
  installment: number
  repairInstallment: number
  downPaymentInstallment: number
  totalIncome: number
  totalDeductions: number
  netPay: number
  hasEntry: boolean
}

const INCOME_FIELDS: { key: keyof Row; label: string }[] = [
  { key: "transportFee",     label: "ค่าขนส่ง" },
  { key: "ot",               label: "OT" },
  { key: "otherIncomeWHT",   label: "รับอื่นๆ (หักภาษี)" },
  { key: "otherIncomeNoWHT", label: "รับอื่นๆ (ไม่หักภาษี)" },
]

const DEDUCTION_FIELDS: { key: keyof Row; label: string }[] = [
  { key: "fuel",                   label: "ค่าเชื้อเพลิง" },
  { key: "gps",                    label: "GPS" },
  { key: "repairInHouse",          label: "ซ่อมแซม (ใน)" },
  { key: "repairOutside",          label: "ซ่อมแซม (นอก)" },
  { key: "mgmtFee8pct",            label: "ค่าดำเนินการ 8%" },
  { key: "labor",                  label: "ค่าแรง" },
  { key: "tire",                   label: "ค่ายาง" },
  { key: "tirePatch",              label: "ปะยาง" },
  { key: "carWash",                label: "ทำความสะอาด" },
  { key: "taxInsurance",           label: "ต่อภาษี/ประกัน" },
  { key: "installment",            label: "ค่างวดรถ" },
  { key: "repairInstallment",      label: "ผ่อนซ่อม" },
  { key: "downPaymentInstallment", label: "ผ่อนดาวน์" },
]

function numVal(row: Row, key: keyof Row): number {
  const v = row[key]
  return typeof v === "number" ? v : 0
}

function SingleSlip({ row, month }: { row: Row; month: string }) {
  const incomeRows = INCOME_FIELDS.filter((f) => numVal(row, f.key) !== 0)
  const deductRows = DEDUCTION_FIELDS.filter((f) => numVal(row, f.key) !== 0)

  return (
    <div className="payslip bg-white p-8 max-w-full">
      {/* Header */}
      <div className="border-b-2 border-zinc-800 pb-3 mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold">บริษัท เมน่า ทรานสปอร์ต จำกัด</h2>
          <p className="text-xs text-zinc-400">Mena Transport Co., Ltd.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">ใบแจ้งเงินเดือน</p>
          <p className="text-xs text-zinc-500">{formatMonth(month)}</p>
        </div>
      </div>

      {/* Employee */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-1 mb-4 text-xs">
        <div><span className="text-zinc-400">รหัส: </span><span className="font-semibold">{row.contractCode}</span></div>
        <div><span className="text-zinc-400">ชื่อคนขับ: </span>{row.driverName}</div>
        <div><span className="text-zinc-400">แพล้นท์: </span>{row.plant}</div>
        <div><span className="text-zinc-400">เบอร์รถ: </span>{row.truckNumber}</div>
        <div><span className="text-zinc-400">วันทำงาน: </span>{row.workingDays} วัน</div>
        <div><span className="text-zinc-400">จำนวนเที่ยว: </span>{row.tripCount} เที่ยว</div>
      </div>

      {/* Income / Deduction */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide bg-zinc-100 px-2 py-1 rounded-t">รายการรับ</div>
          <table className="w-full text-xs border border-zinc-200">
            <tbody className="divide-y divide-zinc-100">
              {incomeRows.map(({ key, label }) => (
                <tr key={key}>
                  <td className="px-2 py-1 text-zinc-600">{label}</td>
                  <td className="px-2 py-1 text-right">{formatMoney(numVal(row, key))}</td>
                </tr>
              ))}
              {incomeRows.length === 0 && <tr><td colSpan={2} className="px-2 py-1 text-zinc-300 text-center">ไม่มีรายการ</td></tr>}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 text-emerald-700 font-semibold">
                <td className="px-2 py-1">รวมรับ</td>
                <td className="px-2 py-1 text-right">{formatMoney(row.totalIncome)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide bg-zinc-100 px-2 py-1 rounded-t">รายการหัก</div>
          <table className="w-full text-xs border border-zinc-200">
            <tbody className="divide-y divide-zinc-100">
              {deductRows.map(({ key, label }) => (
                <tr key={key}>
                  <td className="px-2 py-1 text-zinc-600">{label}</td>
                  <td className="px-2 py-1 text-right">{formatMoney(numVal(row, key))}</td>
                </tr>
              ))}
              {deductRows.length === 0 && <tr><td colSpan={2} className="px-2 py-1 text-zinc-300 text-center">ไม่มีรายการ</td></tr>}
            </tbody>
            <tfoot>
              <tr className="bg-red-50 text-red-600 font-semibold">
                <td className="px-2 py-1">รวมหัก</td>
                <td className="px-2 py-1 text-right">{formatMoney(row.totalDeductions)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Net */}
      <div className="border-2 border-zinc-700 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-600">เงินได้สุทธิ</span>
        <span className={`text-2xl font-bold ${row.netPay < 0 ? "text-red-600" : "text-zinc-900"}`}>
          {formatMoney(row.netPay)} <span className="text-sm font-normal text-zinc-400">บาท</span>
        </span>
      </div>

      {/* Signature */}
      <div className="grid grid-cols-2 gap-8 mt-6 text-[10px] text-zinc-400 text-center">
        <div><div className="border-b border-zinc-300 mb-1 pb-5" />ผู้รับเงิน</div>
        <div><div className="border-b border-zinc-300 mb-1 pb-5" />ผู้จ่ายเงิน</div>
      </div>
    </div>
  )
}

export default function PrintAllPage() {
  const { month } = useParams<{ month: string }>()
  const [rows, setRows]   = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/reports/netpay?month=${month}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setRows((d.rows as Row[]).filter((r) => r.hasEntry))
      })
      .finally(() => setLoading(false))
  }, [month])

  if (loading) return <div className="p-8 text-sm text-zinc-400">กำลังโหลด...</div>

  return (
    <div>
      <div className="print:hidden flex items-center gap-3 mb-6 px-8 pt-6">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          <Printer className="w-4 h-4" />
          พิมพ์ทั้งหมด ({rows.length} ใบ)
        </button>
        <button onClick={() => window.history.back()} className="text-sm text-zinc-500 hover:text-zinc-700">
          ← กลับ
        </button>
        <span className="text-xs text-zinc-400 ml-2">{formatMonth(month)} · {rows.length} ใบ</span>
      </div>

      <div className="space-y-0 print:space-y-0">
        {rows.map((row, i) => (
          <div
            key={row.contractCode}
            className={i < rows.length - 1 ? "border-b-4 border-dashed border-zinc-300 print:border-solid print:border-zinc-200 mb-2 pb-2 print:mb-0 print:pb-0 print:page-break-after" : ""}
          >
            <SingleSlip row={row} month={month} />
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .payslip { page-break-after: always; padding: 12mm; }
          .payslip:last-child { page-break-after: avoid; }
        }
        @page { margin: 8mm; size: A4; }
      `}</style>
    </div>
  )
}
