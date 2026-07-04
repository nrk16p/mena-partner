"use client"

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { Upload, CheckCircle, AlertTriangle, ChevronRight, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatMonth } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayrollPreviewRow {
  contractCode: string
  transportFee: number
  fuel: number
  installment: number
  taxInsurance: number
  repairInstallment: number
  otherIncomeWHT: number
  otherIncomeNoWHT: number
  gps: number
  totalIncome: number
  totalDeductions: number
  netPay: number
}

interface DebtRow {
  issueDate:          string
  debtAcceptanceNo:   string
  branch:             string
  employeeCode:       string
  employeeName:       string
  repairOrderNo:      string
  otherItems:         string
  repairType:         string
  liabilityAmount:    number
  installmentCount:   number
  monthlyInstallment: number
  startDate:          string
  endDate:            string
  status:             string
  contractCode:       string
  matched:            boolean
  matchedBy:          string
  licensePlate:       string
  truckNumber:        string
}

type Step = "upload" | "preview" | "done"
type Tab  = "payroll" | "debt" | "stock"

interface StockRow {
  date:         string
  wd:           string
  mr:           string
  purpose:      string
  itemName:     string
  itemCode:     string
  itemGroup:    string
  truckNumber:  string
  driverName:   string
  licensePlate: string
  issueQty:     number
  unitCost:     number
  amount:       number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps: Step[] = ["upload", "preview", "done"]
  const labels        = ["เลือกไฟล์", "ตรวจสอบ", "เสร็จสิ้น"]
  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step === s
              ? "bg-emerald-600 text-white"
              : steps.indexOf(step) > i
              ? "bg-emerald-100 text-emerald-700"
              : "bg-zinc-100 text-zinc-400"
          }`}>{i + 1}</span>
          <span className={step === s ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-400"}>
            {labels[i]}
          </span>
          {i < 2 && <ChevronRight className="w-4 h-4 text-zinc-300" />}
        </div>
      ))}
    </div>
  )
}

function FileZone({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <div
        className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
        onClick={() => ref.current?.click()}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{file.name}</p>
              <p className="text-xs text-zinc-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-zinc-400" />
            <p className="text-sm text-zinc-500">คลิกเพื่อเลือกไฟล์ หรือลากวางที่นี่</p>
            <p className="text-xs text-zinc-400">รองรับ .xlsx</p>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </>
  )
}

function ErrorBar({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
      <AlertTriangle className="w-4 h-4 shrink-0" />{msg}
    </div>
  )
}

// ─── Payroll import section ───────────────────────────────────────────────────

function PayrollImport() {
  const [step,    setStep]    = useState<Step>("upload")
  const [month,   setMonth]   = useState("")
  const [file,    setFile]    = useState<File | null>(null)
  const [preview, setPreview] = useState<PayrollPreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ upserted: number; modified: number; errors: number } | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function handlePreview() {
    if (!file || !month) { setError("เลือกไฟล์และระบุเดือนก่อน"); return }
    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("month", month)
      const r = await fetch("/api/import/preview", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setPreview(data.rows); setStep("preview")
    } catch { setError("ไม่สามารถอ่านไฟล์ได้") }
    finally { setLoading(false) }
  }

  async function handleConfirm() {
    if (!file || !month) return
    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("month", month)
      const r = await fetch("/api/import/confirm", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setResult(data); setStep("done")
    } catch { setError("ไม่สามารถนำเข้าข้อมูลได้") }
    finally { setLoading(false) }
  }

  const totalNetPay   = preview.reduce((s, r) => s + r.netPay, 0)
  const negativeCount = preview.filter((r) => r.netPay < 0).length

  return (
    <div className="space-y-5">
      <StepBar step={step} />
      <ErrorBar msg={error} />

      {step === "upload" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">เดือนที่นำเข้า</label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">ไฟล์ Excel (.xlsx)</label>
            <FileZone file={file} onFile={setFile} />
          </div>
          <Button onClick={handlePreview} disabled={!file || !month || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? "กำลังอ่าน..." : "ตรวจสอบข้อมูล"}
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-zinc-500">เดือน: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatMonth(month)}</span></p>
              <p className="text-sm text-zinc-500">พนักงาน: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{preview.length} คน</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500">ยอดสุทธิรวม</p>
              <p className={`text-xl font-bold ${totalNetPay >= 0 ? "text-emerald-600" : "text-red-600"}`}>฿{formatMoney(totalNetPay)}</p>
            </div>
            {negativeCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />{negativeCount} ราย มียอดสุทธิติดลบ
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  {["รหัส","ค่าขนส่ง","รายได้รวม","หักรวม","สุทธิ"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-zinc-500 font-medium ${h === "รหัส" ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.contractCode} className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${row.netPay < 0 ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.contractCode}</td>
                    <td className="px-4 py-2 text-right text-zinc-800 dark:text-zinc-200">{formatMoney(row.transportFee)}</td>
                    <td className="px-4 py-2 text-right text-emerald-700 dark:text-emerald-400 font-medium">{formatMoney(row.totalIncome)}</td>
                    <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatMoney(row.totalDeductions)}</td>
                    <td className={`px-4 py-2 text-right font-bold ${row.netPay < 0 ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}>{formatMoney(row.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>ย้อนกลับ</Button>
            <Button onClick={handleConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? "กำลังบันทึก..." : `ยืนยันนำเข้า ${preview.length} รายการ`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">นำเข้าเสร็จสิ้น</h2>
          <div className="flex justify-center gap-8 text-sm">
            <div><p className="text-zinc-400">รายการใหม่</p><p className="text-2xl font-bold text-emerald-600">{result.upserted}</p></div>
            <div><p className="text-zinc-400">อัปเดต</p><p className="text-2xl font-bold text-blue-600">{result.modified}</p></div>
            {result.errors > 0 && <div><p className="text-zinc-400">ข้อผิดพลาด</p><p className="text-2xl font-bold text-red-600">{result.errors}</p></div>}
          </div>
          <div className="flex justify-center gap-3 pt-2 flex-wrap">
            <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setPreview([]); setResult(null); setMonth("") }}>นำเข้าใหม่</Button>
            <Button variant="outline" onClick={() => window.location.href = `/payroll/${month}`}>ดูสลิป {formatMonth(month)}</Button>
            <Button onClick={() => window.location.href = "/admin/month"} className="bg-emerald-600 hover:bg-emerald-700 text-white">จัดการรอบเดือน →</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Debt acceptance import section ──────────────────────────────────────────

const REPAIR_TYPE_LABELS: Record<string, string> = {
  repair:   "ซ่อม",
  tire:     "ยาง",
  accident: "อุบัติเหตุ",
}

function DebtImport() {
  const [step,    setStep]    = useState<Step>("upload")
  const [file,    setFile]    = useState<File | null>(null)
  const [preview, setPreview] = useState<DebtRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ upserted: number; skipped: number } | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [matched, setMatched] = useState(0)

  async function handlePreview() {
    if (!file) { setError("เลือกไฟล์ก่อน"); return }
    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("action", "preview")
      const r    = await fetch("/api/import/debt-acceptance", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setPreview(data.rows); setMatched(data.matched); setStep("preview")
    } catch { setError("ไม่สามารถอ่านไฟล์ได้") }
    finally { setLoading(false) }
  }

  async function handleConfirm() {
    if (!file) return
    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("action", "confirm")
      const r    = await fetch("/api/import/debt-acceptance", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setResult(data); setStep("done")
    } catch { setError("ไม่สามารถนำเข้าข้อมูลได้") }
    finally { setLoading(false) }
  }

  const totalLiability = preview.reduce((s, r) => s + r.liabilityAmount, 0)

  return (
    <div className="space-y-5">
      <StepBar step={step} />
      <ErrorBar msg={error} />

      {step === "upload" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">รูปแบบไฟล์ที่รองรับ</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">ไฟล์ Excel ใบรับสภาพหนี้ — คอลัมน์ตามแบบฟอร์มมาตรฐาน (วันที่ออกรายการ, เลขที่ใบรับสภาพหนี้, รหัสพนักงาน, ...)</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">ไฟล์ Excel (.xlsx)</label>
            <FileZone file={file} onFile={setFile} />
          </div>
          <Button onClick={handlePreview} disabled={!file || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? "กำลังอ่าน..." : "ตรวจสอบข้อมูล"}
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-wrap gap-6 items-start">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">รายการทั้งหมด</p>
              <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">{preview.length}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">ยอดรับผิดรวม</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">฿{totalLiability.toLocaleString("th-TH")}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">จับคู่สัญญาได้</p>
              <p className="text-2xl font-bold text-emerald-600 mt-0.5">{matched} <span className="text-base font-normal text-zinc-400">/ {preview.length}</span></p>
            </div>
            {matched < preview.length && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {preview.length - matched} รายการจับคู่รหัสสัญญาไม่ได้ — จะนำเข้าโดยไม่มีรหัสสัญญา
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  {["เลขที่ใบ","วันที่","รหัสพนักงาน","ชื่อ-สกุล","ทะเบียน / เบอร์รถ","ประเภท","ยอดรับผิด","งวด","งวดละ","เริ่มชำระ","สัญญา (จับคู่จาก)"].map((h) => (
                    <th key={h} className={`px-3 py-2.5 font-semibold text-zinc-500 whitespace-nowrap ${["ยอดรับผิด","งวดละ"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {preview.map((row) => (
                  <tr key={row.debtAcceptanceNo} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${!row.matched ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
                    <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{row.debtAcceptanceNo}</td>
                    <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{row.issueDate}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{row.employeeCode}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{row.employeeName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.licensePlate && <span className="font-mono text-zinc-700 dark:text-zinc-200 text-xs">{row.licensePlate}</span>}
                      {row.licensePlate && row.truckNumber && <span className="text-zinc-300 mx-1">/</span>}
                      {row.truckNumber  && <span className="font-mono text-zinc-500 text-xs">{row.truckNumber}</span>}
                      {!row.licensePlate && !row.truckNumber && <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        row.repairType === "tire"     ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                        row.repairType === "repair"   ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" :
                        row.repairType === "accident" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" :
                        "bg-zinc-100 text-zinc-600"
                      }`}>
                        {REPAIR_TYPE_LABELS[row.repairType] ?? row.repairType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                      ฿{row.liabilityAmount.toLocaleString("th-TH")}
                    </td>
                    <td className="px-3 py-2 text-center text-zinc-500">{row.installmentCount}</td>
                    <td className="px-3 py-2 text-right text-zinc-500 whitespace-nowrap">฿{row.monthlyInstallment.toLocaleString("th-TH")}</td>
                    <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{row.startDate}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.matched ? (
                        <div>
                          <span className="text-emerald-600 font-mono text-xs">{row.contractCode}</span>
                          <span className="ml-1.5 text-[10px] text-zinc-400">
                            ({row.matchedBy === "employeeCode" ? "รหัสพนง." : row.matchedBy === "licensePlate" ? "ทะเบียน" : "เบอร์รถ"})
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-500 text-xs">ไม่พบ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>ย้อนกลับ</Button>
            <Button onClick={handleConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? "กำลังบันทึก..." : `ยืนยันนำเข้า ${preview.length} รายการ`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">นำเข้าเสร็จสิ้น</h2>
          <div className="flex justify-center gap-8 text-sm">
            <div><p className="text-zinc-400">บันทึก/อัปเดต</p><p className="text-2xl font-bold text-emerald-600">{result.upserted}</p></div>
            {result.skipped > 0 && <div><p className="text-zinc-400">ข้ามแถว</p><p className="text-2xl font-bold text-zinc-400">{result.skipped}</p></div>}
          </div>
          <Button
            variant="outline"
            onClick={() => { setStep("upload"); setFile(null); setPreview([]); setResult(null) }}
            className="mt-2"
          >
            นำเข้าใหม่
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Stock movement import section ────────────────────────────────────────────

function StockImport() {
  const [step,    setStep]    = useState<Step>("upload")
  const [file,    setFile]    = useState<File | null>(null)
  const [preview, setPreview] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ upserted: number; modified: number } | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function handlePreview() {
    if (!file) { setError("เลือกไฟล์ก่อน"); return }
    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("action", "preview")
      const r    = await fetch("/api/import/stock-movement", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setPreview(data.rows); setStep("preview")
    } catch { setError("ไม่สามารถอ่านไฟล์ได้") }
    finally { setLoading(false) }
  }

  async function handleConfirm() {
    if (!file) return
    setLoading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("action", "confirm")
      const r    = await fetch("/api/import/stock-movement", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setResult(data); setStep("done")
    } catch { setError("ไม่สามารถนำเข้าข้อมูลได้") }
    finally { setLoading(false) }
  }

  const totalAmount = preview.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5">
      <StepBar step={step} />
      <ErrorBar msg={error} />

      {step === "upload" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">รูปแบบไฟล์ที่รองรับ</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              ไฟล์ Excel การเคลื่อนไหวของสินค้า — คอลัมน์ตามแบบฟอร์มมาตรฐาน (วันที่, PR, PO, DD, WD, MR, ..., ชื่อสินค้า, รหัสสินค้า, จ่าย, ราคาทุน, ยอดเงิน, หมายเหตุ)
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">ไฟล์ Excel (.xlsx)</label>
            <FileZone file={file} onFile={setFile} />
          </div>
          <Button onClick={handlePreview} disabled={!file || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? "กำลังอ่าน..." : "ตรวจสอบข้อมูล"}
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-wrap gap-6 items-start">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">รายการทั้งหมด</p>
              <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">{preview.length}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">ยอดเงินรวม</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">฿{totalAmount.toLocaleString("th-TH")}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">MR ที่เกี่ยวข้อง</p>
              <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">{new Set(preview.map((r) => r.mr).filter(Boolean)).size}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  {["วันที่","WD","MR","จุดประสงค์","ชื่อสินค้า","รหัสสินค้า","กลุ่มสินค้า","เลขรถ","พจส.","ทะเบียน","จ่าย","ราคาทุน","ยอดเงิน"].map((h) => (
                    <th key={h} className={`px-3 py-2.5 font-semibold text-zinc-500 whitespace-nowrap ${["จ่าย","ราคาทุน","ยอดเงิน"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{row.date}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">{row.wd || "—"}</td>
                    <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{row.mr || "—"}</td>
                    <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{row.purpose || "—"}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{row.itemName}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">{row.itemCode || "—"}</td>
                    <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{row.itemGroup || "—"}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">{row.truckNumber || "—"}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{row.driverName || "—"}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">{row.licensePlate || "—"}</td>
                    <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">{row.issueQty.toLocaleString("th-TH")}</td>
                    <td className="px-3 py-2 text-right text-zinc-500 whitespace-nowrap">฿{row.unitCost.toLocaleString("th-TH")}</td>
                    <td className="px-3 py-2 text-right font-semibold text-zinc-800 dark:text-zinc-100 whitespace-nowrap">฿{row.amount.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>ย้อนกลับ</Button>
            <Button onClick={handleConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? "กำลังบันทึก..." : `ยืนยันนำเข้า ${preview.length} รายการ`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">นำเข้าเสร็จสิ้น</h2>
          <div className="flex justify-center gap-8 text-sm">
            <div><p className="text-zinc-400">รายการใหม่</p><p className="text-2xl font-bold text-emerald-600">{result.upserted}</p></div>
            {result.modified > 0 && <div><p className="text-zinc-400">อัปเดต</p><p className="text-2xl font-bold text-blue-600">{result.modified}</p></div>}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setPreview([]); setResult(null) }}>นำเข้าใหม่</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => window.location.href = "/vehicle-cost"}>
              ดูการเคลื่อนไหวของสินค้า →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const [tab, setTab] = useState<Tab>("payroll")

  if (!isAdmin) {
    return <div className="p-8 text-zinc-400">เฉพาะผู้ดูแลระบบเท่านั้น</div>
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">นำเข้าข้อมูล Excel</h1>
        <p className="text-sm text-zinc-500 mt-1">อัปโหลดไฟล์ Excel เพื่อบันทึกข้อมูลลงระบบ</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl w-fit">
        {([
          { id: "payroll", label: "Payroll เงินเดือน" },
          { id: "debt",    label: "ใบรับสภาพหนี้" },
          { id: "stock",   label: "การเคลื่อนไหวของสินค้า" },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "payroll" && <PayrollImport />}
      {tab === "debt"    && <DebtImport />}
      {tab === "stock"   && <StockImport />}
    </div>
  )
}
