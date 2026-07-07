"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { PlusCircle, Search, AlertTriangle, Download, FileText, Upload, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/utils"
import { missingDocFields } from "@/lib/contract-doc"
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
  { field: "saleContractUrl",      label: "ซื้อขาย",   full: "สัญญาซื้อขาย" },
  { field: "hireContractUrl",      label: "ว่าจ้าง",   full: "สัญญาว่าจ้าง" },
  { field: "guaranteeContractUrl", label: "ค้ำประกัน", full: "สัญญาค้ำประกัน" },
] as const
type AttachField = (typeof ATTACH_DOCS)[number]["field"]

export default function ContractsPage() {
  const { data: session } = useSession()
  const [items, setItems]   = useState<Contract[]>([])
  const [q, setQ]           = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)   // `${contractId}:${field}`
  const isAdmin = session?.user?.role === "admin"

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
      const put = await fetch(`/api/contracts/${c._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: url }),
      })
      if (!put.ok) throw new Error("บันทึกไฟล์แนบไม่สำเร็จ")
      setItems((prev) => prev.map((x) => (x._id === c._id ? { ...x, [field]: url } : x)))
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

  function handleExportCSV() {
    if (!items.length) return
    const headers = [
      "รหัส","ชื่อผู้เช่าซื้อ","ทะเบียน","เบอร์รถ","ยี่ห้อ","รุ่น",
      "วันที่ทำสัญญา","วันที่เริ่ม","ราคารถ","เงินดาวน์","ค่างวด/เดือน","จำนวนงวด",
      "บริษัทประกัน","วันต่อภาษี","วันหมดอายุ","สถานะ","ข้อมูลครบ","เอกสารแนบ",
    ]
    const rows = items.map((c) => {
      const missing = missingDocFields(c)
      const attached = ATTACH_DOCS.filter(({ field }) => c[field]).length
      return [
        c.contractCode, c.buyerName, c.licensePlate, c.truckNumber,
        c.vehicleBrand, c.vehicleModel ?? "",
        c.contractDate?.slice(0, 10) ?? "", c.startDate?.slice(0, 10) ?? "",
        c.totalPrice, c.downPayment, c.monthlyInstallment, c.totalInstallments,
        c.insurer ?? "", c.taxRenewalDate ?? "", c.taxExpiryDate ?? "", c.status,
        missing.length === 0 ? "ครบ" : `ขาด ${missing.length}`,
        `${attached}/${ATTACH_DOCS.length}`,
      ].map((v) => (typeof v === "string" && v.includes(",")) ? `"${v}"` : v).join(",")
    })
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `contracts-${statusFilter || "all"}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const counts = {
    active:     items.filter((c) => c.status === "active").length,
    completed:  items.filter((c) => c.status === "completed").length,
    terminated: items.filter((c) => c.status === "terminated").length,
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
            {items.length} สัญญา
            {statusFilter === "" && (
              <> · ใช้งาน <span className="text-emerald-600 font-medium">{counts.active}</span> / สิ้นสุด {counts.completed} / ยกเลิก {counts.terminated}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
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
              <th className="px-4 py-3 text-left font-semibold">เอกสารแนบ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((c) => {
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
                  {/* ── เอกสารแนบ: ดูไฟล์ที่แนบแล้ว / แอดมินแนบไฟล์ได้จากหน้านี้ ── */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        href={`/contracts/${c._id}/document`}
                        title="เอกสารสัญญา (PDF)"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shrink-0"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      {ATTACH_DOCS.map(({ field, label, full }) => {
                        const url  = c[field]
                        const busy = uploading === `${c._id}:${field}`
                        if (url) return (
                          <a
                            key={field}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            title={`เปิด${full}`}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                          >
                            <FileText className="w-2.5 h-2.5" /> {label}
                          </a>
                        )
                        if (!isAdmin) return (
                          <span
                            key={field}
                            title={`ยังไม่ได้แนบ${full}`}
                            className="inline-flex items-center text-[10px] text-zinc-300 dark:text-zinc-600 border border-dashed border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded"
                          >
                            {label}
                          </span>
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
      </div>
    </div>
  )
}
