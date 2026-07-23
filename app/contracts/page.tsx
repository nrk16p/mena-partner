"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { PlusCircle, Search, AlertTriangle, Download, FileText, Upload, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePagination, PaginationBar } from "@/components/pagination"
import { formatMoney } from "@/lib/utils"
import { missingDocFields } from "@/lib/contract-doc"
import { exportToExcel, todayStamp } from "@/lib/export-excel"
import type { Contract } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน", completed: "สิ้นสุด", terminated: "ยกเลิก"
}
const STATUS_COLOR: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  completed:  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  terminated: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
}

const STATUS_TABS = [
  { key: "",           label: "ทั้งหมด" },
  { key: "active",     label: "ใช้งาน" },
  { key: "completed",  label: "สิ้นสุด" },
  { key: "terminated", label: "ยกเลิก" },
]

// เอกสารแนบ 3 ไฟล์ต่อสัญญา (ชุดเดียวกับหน้าเพิ่มสัญญา)
const ATTACH_DOCS = [
  { field: "saleContractUrl",      label: "ซื้อขาย",    full: "สัญญาซื้อขาย (PDF)" },
  { field: "promotionDocUrl",      label: "แนบท้าย",    full: "เอกสารแนบท้าย (PDF)" },
  { field: "hireContractUrl",      label: "ว่าจ้าง",    full: "สัญญาว่าจ้าง (PDF)" },
  { field: "guaranteeContractUrl", label: "ค้ำประกัน",  full: "สัญญาค้ำประกัน (PDF)" },
  { field: "creditorDocUrl",       label: "เปิดเจ้าหนี้", full: "เปิดเจ้าหนี้ (PDF)" },
] as const
type AttachField = (typeof ATTACH_DOCS)[number]["field"]

export default function ContractsPage() {
  const { data: session } = useSession()
  const [items, setItems]   = useState<Contract[]>([])
  const [q, setQ]           = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [docFilter, setDocFilter] = useState("")   // "" ทั้งหมด | "complete" ครบ | "incomplete" ไม่ครบ
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)   // `${contractId}:${field}`
  const [confirmDel, setConfirmDel] = useState<string | null>(null) // `${contractId}:${field}` ที่รอยืนยันลบ

  async function uploadAttachment(c: Contract, field: AttachField, file: File) {
    const key = `${c._id}:${field}`
    setUploading(key)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "contracts")
      const up = await fetch("/api/upload", { method: "POST", body: fd })
      if (!up.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ")
      const { url } = await up.json()
      const put = await fetch(`/api/contracts/${c._id}/attachment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, url }),
      })
      if (!put.ok) throw new Error("บันทึกไฟล์แนบไม่สำเร็จ")
      setItems((prev) => prev.map((x) => (x._id === c._id ? { ...x, [field]: url } : x)))
    } catch (err) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
    } finally {
      setUploading(null)
    }
  }

  // ลบไฟล์แนบ (เคลียร์ field ใน contract — ไฟล์ใน storage คงอยู่เผื่อกู้คืน)
  async function removeAttachment(c: Contract, field: AttachField) {
    setConfirmDel(null)
    const key = `${c._id}:${field}`
    setUploading(key)
    try {
      const res = await fetch(`/api/contracts/${c._id}/attachment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, url: "" }),
      })
      if (!res.ok) throw new Error("ลบไฟล์แนบไม่สำเร็จ")
      setItems((prev) => prev.map((x) => (x._id === c._id ? { ...x, [field]: "" } : x)))
    } catch (err) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาด")
    } finally {
      setUploading(null)
    }
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (statusFilter) params.set("status", statusFilter)
        const res = await fetch(`/api/contracts?${params}`)
        if (res.ok) setItems(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, statusFilter])

  const today = new Date().toISOString().slice(0, 10)
  const d60 = new Date(); d60.setDate(d60.getDate() + 60)
  const in60 = d60.toISOString().slice(0, 10)

  async function handleExportExcel() {
    if (!visible.length) return
    const rows = visible.map((c) => {
      const missing = missingDocFields(c)
      const attached = ATTACH_DOCS.filter(({ field }) => c[field]).length
      return {
        "รหัส": c.contractCode,
        "ชื่อผู้เช่าซื้อ": c.buyerName,
        "ทะเบียน": c.licensePlate,
        "เบอร์รถ": c.truckNumber,
        "ยี่ห้อ": c.vehicleBrand,
        "รุ่น": c.vehicleModel ?? "",
        "วันที่ทำสัญญา": c.contractDate?.slice(0, 10) ?? "",
        "วันที่เริ่ม": c.startDate?.slice(0, 10) ?? "",
        "ราคารถ": c.totalPrice,
        "เงินดาวน์": c.downPayment,
        "ค่างวด/เดือน": c.monthlyInstallment,
        "จำนวนงวด": c.totalInstallments,
        "บริษัทประกัน": c.insurer ?? "",
        "วันต่อภาษี": c.taxRenewalDate ?? "",
        "วันหมดอายุ": c.taxExpiryDate ?? "",
        "สถานะ": c.status,
        "ข้อมูลครบ": missing.length === 0 ? "ครบ" : `ขาด ${missing.length}`,
        "สถานะเอกสาร": c.saleContractUrl ? "เอกสารครบ" : "ติดตามเอกสาร",
        "เอกสารแนบ": `${attached}/${ATTACH_DOCS.length}`,
      }
    })
    await exportToExcel([{ name: "สัญญา", rows }], `contracts-${todayStamp()}`)
  }

  // ── กรองตามความครบถ้วนของข้อมูลเอกสาร (เกณฑ์เดียวกับคอลัมน์ "ข้อมูลครบ") ──
  const visible =
    docFilter === ""
      ? items
      : items.filter((c) => (missingDocFields(c).length === 0) === (docFilter === "complete"))

  const pg = usePagination(visible, 50, [q, statusFilter, docFilter])

  const counts = {
    active:     items.filter((c) => c.status === "active").length,
    completed:  items.filter((c) => c.status === "completed").length,
    terminated: items.filter((c) => c.status === "terminated").length,
    complete:   items.filter((c) => missingDocFields(c).length === 0).length,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" />
            สัญญา
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {visible.length} สัญญา
            {statusFilter === "" && (
              <> · ใช้งาน <span className="text-emerald-600 font-medium">{counts.active}</span> / สิ้นสุด {counts.completed} / ยกเลิก {counts.terminated}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleExportExcel}
              title="ดาวน์โหลดเป็น Excel (.xlsx)"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-3 py-2 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          )}
          {session?.user?.role === "admin" && (
            <Link href="/contracts/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <PlusCircle className="w-4 h-4 mr-1.5" /> เพิ่มสัญญา
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* กรองตามความครบถ้วนของข้อมูลเอกสารสัญญา */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
          {[
            { key: "", label: "ข้อมูลทั้งหมด" },
            { key: "complete", label: `ครบ (${counts.complete})` },
            { key: "incomplete", label: `ไม่ครบ (${items.length - counts.complete})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDocFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                docFilter === tab.key
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <Input
            placeholder="ค้นหา รหัส / ชื่อ / ทะเบียน / เบอร์รถ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-[11px] text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">รหัสสัญญา</th>
              <th className="px-4 py-3 text-left font-semibold">ชื่อผู้เช่าซื้อ</th>
              <th className="px-4 py-3 text-left font-semibold">ทะเบียนรถ</th>
              <th className="px-4 py-3 text-left font-semibold">ยี่ห้อ / รุ่น</th>
              <th className="px-4 py-3 text-right font-semibold">ค่างวด/เดือน</th>
              <th className="px-4 py-3 text-center font-semibold">ประกัน</th>
              <th className="px-4 py-3 text-center font-semibold">สถานะ</th>
              <th className="px-4 py-3 text-center font-semibold">ข้อมูลครบ</th>
              <th className="px-4 py-3 text-center font-semibold">สถานะเอกสาร</th>
              <th className="px-4 py-3 text-left font-semibold">เอกสารแนบ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : pg.paged.map((c) => {
              const insExpired  = c.taxExpiryDate && c.taxExpiryDate < today
              const insExpiring = !insExpired && c.taxExpiryDate && c.taxExpiryDate <= in60
              const missing     = missingDocFields(c)
              return (
                <tr key={c._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contracts/${c._id}`}
                      className="font-mono font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline text-xs"
                    >
                      {c.contractCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-800 dark:text-zinc-200">{c.buyerName}</div>
                    {c.driverName && c.driverName !== c.buyerName && (
                      <div className="text-xs text-zinc-400 mt-0.5">{c.driverName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{c.licensePlate || "—"}</span>
                    {c.truckNumber && <div className="text-xs text-zinc-400 mt-0.5">{c.truckNumber}</div>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                    <span className="font-medium">{c.vehicleBrand || "—"}</span>
                    {c.vehicleModel && <span className="text-zinc-400"> · {c.vehicleModel}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.monthlyInstallment ? (
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatMoney(c.monthlyInstallment)}</span>
                        <span className="text-xs text-zinc-400 ml-1">×{c.totalInstallments}</span>
                      </div>
                    ) : <span className="text-zinc-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {insExpired ? (
                      <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-medium" title={`หมดอายุ ${c.taxExpiryDate}`}>
                        <AlertTriangle className="w-3 h-3" /> หมดแล้ว
                      </span>
                    ) : insExpiring ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs font-medium" title={`หมด ${c.taxExpiryDate}`}>
                        <AlertTriangle className="w-3 h-3" /> ใกล้หมด
                      </span>
                    ) : c.taxExpiryDate ? (
                      <span className="text-xs text-zinc-400">{c.taxExpiryDate.slice(0, 7)}</span>
                    ) : (
                      <span className="text-zinc-200 dark:text-zinc-700 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  {/* ── ความครบถ้วนของข้อมูลเอกสารสัญญา (เกณฑ์เดียวกับหน้าแก้ไข/หน้าพิมพ์) ── */}
                  <td className="px-4 py-3 text-center">
                    {missing.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> ครบ
                      </span>
                    ) : (
                      <Link
                        href={`/contracts/${c._id}`}
                        title={`ขาด: ${missing.map((f) => f.label).join(", ")}`}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-950/60"
                      >
                        <AlertTriangle className="w-3 h-3" /> ขาด {missing.length}
                      </Link>
                    )}
                  </td>
                  {/* ── สถานะเอกสาร: อัปโหลดสัญญาซื้อขายแล้ว = เอกสารครบ / ยังไม่มี = ติดตามเอกสาร ── */}
                  <td className="px-4 py-3 text-center">
                    {c.saleContractUrl ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> เอกสารครบ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> ติดตามเอกสาร
                      </span>
                    )}
                  </td>
                  {/* ── เอกสารแนบ: ดูไฟล์ที่แนบแล้ว / แอดมินแนบไฟล์ได้จากหน้านี้ ── */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ATTACH_DOCS.map(({ field, label, full }) => {
                        const url  = c[field]
                        const key  = `${c._id}:${field}`
                        const busy = uploading === key
                        if (url) return (
                          confirmDel === key ? (
                            <span key={field} className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded pl-1.5 pr-0.5 py-0.5">
                              <button type="button" disabled={busy} onClick={() => removeAttachment(c, field)}
                                className="font-semibold text-white bg-red-500 hover:bg-red-600 rounded px-1.5 py-0.5 disabled:opacity-40">ยืนยันลบ</button>
                              <button type="button" onClick={() => setConfirmDel(null)}
                                className="text-zinc-400 hover:text-zinc-600 px-0.5">ยกเลิก</button>
                            </span>
                          ) : (
                          <span
                            key={field}
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 pl-1.5 pr-0.5 py-0.5 rounded"
                          >
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              title={`เปิด${full}`}
                              className="inline-flex items-center gap-1 hover:underline"
                            >
                              <FileText className="w-2.5 h-2.5" /> {label}
                            </a>
                            <button
                              type="button"
                              title={`ลบ${full}`}
                              disabled={busy}
                              onClick={() => setConfirmDel(key)}
                              className="ml-0.5 text-emerald-400 hover:text-red-500 disabled:opacity-40"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                          )
                        )
                        return (
                          <label
                            key={field}
                            title={`แนบ${full} (PDF/รูปภาพ สูงสุด 20 MB)`}
                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-dashed cursor-pointer transition-colors
                              ${busy
                                ? "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:border-blue-700"
                                : "border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
                              }`}
                          >
                            {busy ? (
                              <div className="w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Upload className="w-2.5 h-2.5" />
                            )}
                            {label}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              disabled={!!uploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) uploadAttachment(c, field, f)
                                e.target.value = ""
                              }}
                            />
                          </label>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <PaginationBar {...pg} unit="สัญญา" />
      </div>
    </div>
  )
}
