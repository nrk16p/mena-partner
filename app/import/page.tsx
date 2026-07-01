"use client"

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { Upload, CheckCircle, AlertTriangle, ChevronRight, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, formatMonth } from "@/lib/utils"

interface PreviewRow {
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

type Step = "upload" | "preview" | "done"

export default function ImportPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"

  const fileRef      = useRef<HTMLInputElement>(null)
  const [step, setStep]     = useState<Step>("upload")
  const [month, setMonth]   = useState("")
  const [file, setFile]     = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ upserted: number; modified: number; errors: number } | null>(null)
  const [error, setError]     = useState<string | null>(null)

  if (!isAdmin) {
    return <div className="p-8 text-zinc-400">เฉพาะผู้ดูแลระบบเท่านั้น</div>
  }

  async function handlePreview() {
    if (!file || !month) { setError("เลือกไฟล์และระบุเดือนก่อน"); return }
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("month", month)
      const r = await fetch("/api/import/preview", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setPreview(data.rows)
      setStep("preview")
    } catch {
      setError("ไม่สามารถอ่านไฟล์ได้")
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!file || !month) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("month", month)
      const r = await fetch("/api/import/confirm", { method: "POST", body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return }
      setResult(data)
      setStep("done")
    } catch {
      setError("ไม่สามารถนำเข้าข้อมูลได้")
    } finally {
      setLoading(false)
    }
  }

  const totalNetPay  = preview.reduce((s, r) => s + r.netPay, 0)
  const negativeCount = preview.filter((r) => r.netPay < 0).length

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">นำเข้าข้อมูล Excel</h1>
        <p className="text-sm text-zinc-500 mt-1">อัปโหลดไฟล์ Payroll Excel เพื่อบันทึกข้อมูลเงินเดือนลงระบบ</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "preview", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-emerald-600 text-white" :
              (["upload", "preview", "done"].indexOf(step) > i ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400")
            }`}>{i + 1}</span>
            <span className={step === s ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-400"}>
              {s === "upload" ? "เลือกไฟล์" : s === "preview" ? "ตรวจสอบ" : "เสร็จสิ้น"}
            </span>
            {i < 2 && <ChevronRight className="w-4 h-4 text-zinc-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">เดือนที่นำเข้า (YYYY-MM)</label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-48"
              placeholder="2026-05"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">ไฟล์ Excel (.xlsx)</label>
            <div
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
              onClick={() => fileRef.current?.click()}
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
                  <p className="text-xs text-zinc-400">รองรับเฉพาะ .xlsx</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button onClick={handlePreview} disabled={!file || !month || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? "กำลังอ่าน..." : "ตรวจสอบข้อมูล"}
          </Button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-zinc-500">เดือน: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatMonth(month)}</span></p>
                <p className="text-sm text-zinc-500">พนักงาน: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{preview.length} คน</span></p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-500">ยอดสุทธิรวม</p>
                <p className={`text-xl font-bold ${totalNetPay >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  ฿{formatMoney(totalNetPay)}
                </p>
              </div>
              {negativeCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                  {negativeCount} ราย มียอดสุทธิติดลบ
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-4 py-3 text-left text-zinc-500 font-medium">รหัส</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">ค่าขนส่ง</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">รายได้รวม</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">หักรวม</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">สุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr
                    key={row.contractCode}
                    className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      row.netPay < 0 ? "bg-red-50/50 dark:bg-red-950/20" : ""
                    }`}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.contractCode}</td>
                    <td className="px-4 py-2 text-right text-zinc-800 dark:text-zinc-200">{formatMoney(row.transportFee)}</td>
                    <td className="px-4 py-2 text-right text-emerald-700 dark:text-emerald-400 font-medium">{formatMoney(row.totalIncome)}</td>
                    <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{formatMoney(row.totalDeductions)}</td>
                    <td className={`px-4 py-2 text-right font-bold ${row.netPay < 0 ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {formatMoney(row.netPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")} disabled={loading}>
              ย้อนกลับ
            </Button>
            <Button onClick={handleConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? "กำลังบันทึก..." : `ยืนยันนำเข้า ${preview.length} รายการ`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && result && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">นำเข้าเสร็จสิ้น</h2>
          <div className="flex justify-center gap-8 text-sm">
            <div>
              <p className="text-zinc-400">รายการใหม่</p>
              <p className="text-2xl font-bold text-emerald-600">{result.upserted}</p>
            </div>
            <div>
              <p className="text-zinc-400">อัปเดต</p>
              <p className="text-2xl font-bold text-blue-600">{result.modified}</p>
            </div>
            {result.errors > 0 && (
              <div>
                <p className="text-zinc-400">ข้อผิดพลาด</p>
                <p className="text-2xl font-bold text-red-600">{result.errors}</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-3 pt-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => { setStep("upload"); setFile(null); setPreview([]); setResult(null); setMonth("") }}
            >
              นำเข้าใหม่
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = `/payroll/${month}`}
            >
              ดูสลิป {formatMonth(month)}
            </Button>
            <Button
              onClick={() => window.location.href = "/admin/month"}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              จัดการรอบเดือน →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
