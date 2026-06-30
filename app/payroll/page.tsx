"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Printer, ChevronRight, Zap, Trash2, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatMonth, formatMoney, prevMonth as getPrevMonth } from "@/lib/utils"
import type { Driver, PayrollEntry } from "@/types"
import { useSession } from "next-auth/react"

export default function PayrollPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"

  const [months, setMonths]     = useState<string[]>([])
  const [month, setMonth]       = useState<string | null>(null)
  const [drivers, setDrivers]   = useState<Driver[]>([])
  const [entries, setEntries]   = useState<PayrollEntry[]>([])
  const [prevEntries, setPrevEntries] = useState<PayrollEntry[]>([])
  const [q, setQ]               = useState("")
  const [plantFilter, setPlantFilter] = useState("")
  const [showPending, setShowPending] = useState(false)
  const [loading, setLoading]   = useState(false)

  const loadEntries = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const [curr, prev] = await Promise.all([
        fetch(`/api/payroll?month=${m}`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/payroll?month=${getPrevMonth(m)}`).then((r) => r.ok ? r.json() : []),
      ])
      setEntries(Array.isArray(curr) ? curr : [])
      setPrevEntries(Array.isArray(prev) ? prev : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetch("/api/payroll/months")
      .then((r) => r.ok ? r.json() : [])
      .then((ms: string[]) => { setMonths(ms); if (ms.length > 0) setMonth(ms[0]) })
      .catch(() => {})
    fetch("/api/drivers?status=active")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDrivers(Array.isArray(d) ? d : []))
      .catch(() => setDrivers([]))
  }, [])

  useEffect(() => {
    if (!month) return
    loadEntries(month)
  }, [month, loadEntries])

  const entryMap     = Object.fromEntries(entries.map((e) => [e.contractCode, e]))
  const prevEntryMap = Object.fromEntries(prevEntries.map((e) => [e.contractCode, e]))

  // Unique plant list from drivers
  const plants = Array.from(new Set(drivers.map((d) => d.plant).filter(Boolean))).sort()

  const filtered = drivers.filter((d) => {
    const matchQ = !q || [d.contractCode, d.driverName, d.plant ?? ""]
      .some((v) => v.toLowerCase().includes(q.toLowerCase()))
    const matchPending = !showPending || !entryMap[d.contractCode]
    const matchPlant = !plantFilter || d.plant === plantFilter
    return matchQ && matchPending && matchPlant
  })

  const recorded = entries.length
  const totalNetPay = entries.reduce((s, e) => s + (e.netPay ?? 0), 0)
  const entryCodeSet = new Set(entries.map((e) => e.contractCode))
  const nextPending = drivers.find((d) => !entryCodeSet.has(d.contractCode))
  const pendingCount = drivers.filter((d) => !entryCodeSet.has(d.contractCode)).length

  async function handleBatchCreate() {
    if (!month) return
    const pending = drivers.filter((d) => !entryCodeSet.has(d.contractCode)).length
    if (!confirm(`สร้างเงินเดือนอัตโนมัติให้ ${pending} คนที่ยังไม่บันทึก?\n\nระบบจะดึงค่าขนส่งจากรายเที่ยว, คำนวณค่าดำเนินการ 8%, และเติมค่างวด+ประกันจากสัญญาอัตโนมัติ`)) return
    setLoading(true)
    try {
      const r = await fetch(`/api/payroll/batch-create?month=${month}`, { method: "POST" })
      const d = await r.json()
      if (r.ok) {
        alert(`สร้างสำเร็จ ${d.created} รายการ${d.errors > 0 ? ` (${d.errors} ผิดพลาด)` : ""}`)
        await loadEntries(month)
      } else {
        alert(d.error ?? "เกิดข้อผิดพลาด")
      }
    } finally { setLoading(false) }
  }

  async function handleBatchDelete() {
    if (!month) return
    if (!confirm(`ลบข้อมูลเงินเดือนทั้งหมดของเดือน ${formatMonth(month)} (${recorded} รายการ)?\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`)) return
    setLoading(true)
    try {
      const r = await fetch(`/api/payroll?month=${month}`, { method: "DELETE" })
      const d = await r.json()
      if (r.ok) {
        alert(`ลบแล้ว ${d.deleted} รายการ`)
        await loadEntries(month)
      }
    } finally { setLoading(false) }
  }

  function handleExportCSV() {
    if (!month || entries.length === 0) return
    const headers = ["รหัส","ชื่อ","แพล้นท์","เที่ยว","วันทำงาน","ค่าขนส่ง","OT","รับอื่นๆ WHT","รับอื่นๆ ไม่WHT","รวมรับ","เชื้อเพลิง","GPS","ซ่อมใน","ซ่อมนอก","ค่าดำเนินการ8%","ค่าแรง","ยาง","ปะยาง","ล้างรถ","ต่อภาษี","ค่างวด","ผ่อนซ่อม","ดาวน์","รวมหัก","สุทธิ"]
    const driverMap = Object.fromEntries(drivers.map((d) => [d.contractCode, d]))

    const rows = entries.map((e) => {
      const d = driverMap[e.contractCode]
      return [
        e.contractCode,
        d?.driverName ?? "",
        d?.plant ?? "",
        e.tripCount,
        e.workingDays,
        e.transportFee,
        e.ot,
        e.otherIncomeWHT,
        e.otherIncomeNoWHT,
        e.totalIncome,
        e.fuel,
        e.gps,
        e.repairInHouse,
        e.repairOutside,
        e.mgmtFee8pct,
        e.labor,
        e.tire,
        e.tirePatch,
        e.carWash,
        e.taxInsurance,
        e.installment,
        e.repairInstallment,
        e.downPaymentInstallment,
        e.totalDeductions,
        e.netPay,
      ].map((v) => (typeof v === "string" && v.includes(",")) ? `"${v}"` : v).join(",")
    })

    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payroll-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">เงินเดือน</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            บันทึกแล้ว {recorded} / {drivers.length} คน
            {recorded > 0 && <> · สุทธิรวม <span className="text-zinc-600 font-medium">{formatMoney(totalNetPay)}</span></>}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {pendingCount > 0 && month && (
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={handleBatchCreate}
              className="flex items-center gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
              title={`สร้างเงินเดือนอัตโนมัติให้ ${pendingCount} คนที่ยังไม่บันทึก`}
            >
              <Zap className="w-3 h-3" />
              สร้างอัตโนมัติ ({pendingCount})
            </Button>
          )}
          {nextPending && month && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/payroll/${month}/${nextPending.contractCode}`)}
              className="flex items-center gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              กรอกถัดไป ({nextPending.contractCode})
              <ChevronRight className="w-3 h-3" />
            </Button>
          )}
          {month && recorded > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          )}
          {month && recorded > 0 && (
            <Link
              href={`/payroll/${month}/print-all`}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-2"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์ทั้งหมด
            </Link>
          )}
          {isAdmin && month && recorded > 0 && (
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50"
              title="ลบข้อมูลเงินเดือนทั้งหมดของเดือนนี้"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ล้างเดือนนี้
            </button>
          )}
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
          >
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Progress bar */}
      {drivers.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>บันทึกแล้ว {recorded} / {drivers.length} คน</span>
            <span>{Math.round((recorded / drivers.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${recorded === drivers.length ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${(recorded / drivers.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Plant filter tabs */}
      {plants.length > 1 && (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          <button
            onClick={() => setPlantFilter("")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              !plantFilter
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            ทั้งหมด
          </button>
          {plants.map((p) => {
            const driversInPlant = drivers.filter((d) => d.plant === p)
            const recordedInPlant = driversInPlant.filter((d) => entryMap[d.contractCode]).length
            return (
              <button
                key={p}
                onClick={() => setPlantFilter(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  plantFilter === p
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {p}
                <span className="ml-1 text-zinc-400">
                  ({recordedInPlant}/{driversInPlant.length})
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ชื่อ / แพล้นท์"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPending}
            onChange={(e) => setShowPending(e.target.checked)}
            className="rounded"
          />
          แสดงเฉพาะที่ยังไม่บันทึก
        </label>
        {showPending && <span className="text-xs text-amber-600 font-medium">{filtered.length} คน</span>}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-right">เที่ยว</th>
              <th className="px-4 py-3 text-right">รายรับ</th>
              <th className="px-4 py-3 text-right">รายหัก</th>
              <th className="px-4 py-3 text-right">สุทธิ</th>
              <th className="px-4 py-3 text-right text-zinc-400">เทียบเดือนก่อน</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : filtered.map((d) => {
              const entry     = entryMap[d.contractCode]
              const prevEntry = prevEntryMap[d.contractCode]
              const delta     = entry && prevEntry ? entry.netPay - prevEntry.netPay : null

              return (
                <tr key={d._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium">{d.contractCode}</td>
                  <td className="px-4 py-3">{d.driverName}</td>
                  <td className="px-4 py-3 text-zinc-500">{d.plant}</td>
                  <td className="px-4 py-3 text-right text-zinc-500 text-xs">
                    {entry ? entry.tripCount : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    {entry ? formatMoney(entry.totalIncome) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {entry ? formatMoney(entry.totalDeductions) : "-"}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${entry && entry.netPay < 0 ? "text-red-600" : ""}`}>
                    {entry ? formatMoney(entry.netPay) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {delta !== null ? (
                      <span className={`text-xs font-medium ${
                        delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-zinc-400"
                      }`}>
                        {delta > 0 ? "+" : ""}{formatMoney(delta)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {entry ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {entry && (
                        <Link
                          href={`/payroll/${month}/${d.contractCode}/print`}
                          className="text-zinc-400 hover:text-zinc-600"
                          title="พิมพ์ใบแจ้งเงินเดือน"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link
                        href={`/payroll/${month}/${d.contractCode}`}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        {entry ? "แก้ไข →" : "กรอก →"}
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Totals row */}
          {!loading && filtered.length > 0 && entries.length > 0 && (() => {
            const visibleEntries = filtered.map((d) => entryMap[d.contractCode]).filter(Boolean)
            if (visibleEntries.length === 0) return null
            const sumIncome     = visibleEntries.reduce((s, e) => s + (e.totalIncome ?? 0), 0)
            const sumDeductions = visibleEntries.reduce((s, e) => s + (e.totalDeductions ?? 0), 0)
            const sumNet        = visibleEntries.reduce((s, e) => s + (e.netPay ?? 0), 0)
            const prevVisible   = filtered.map((d) => prevEntryMap[d.contractCode]).filter(Boolean)
            const prevSumNet    = prevVisible.reduce((s, e) => s + (e.netPay ?? 0), 0)
            const totalDelta    = prevVisible.length > 0 ? sumNet - prevSumNet : null
            return (
              <tfoot>
                <tr className="bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold border-t-2 border-zinc-200 dark:border-zinc-700">
                  <td className="px-4 py-3" colSpan={4}>รวม {visibleEntries.length} คน</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatMoney(sumIncome)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatMoney(sumDeductions)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(sumNet)}</td>
                  <td className="px-4 py-3 text-right">
                    {totalDelta !== null && (
                      <span className={`text-xs font-medium ${
                        totalDelta > 0 ? "text-emerald-600" : totalDelta < 0 ? "text-red-500" : "text-zinc-400"
                      }`}>
                        {totalDelta > 0 ? "+" : ""}{formatMoney(totalDelta)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </div>
    </div>
  )
}
