"use client"

import { useEffect, useState, useMemo } from "react"
import { Car, CreditCard, Banknote, Search, BarChart3 } from "lucide-react"
import { Input } from "@/components/ui/input"

interface PriceRow {
  licensePlate:         string
  status:               "contract" | "active" | "inactive"
  downPayment:          number
  cashDown:             number
  remainingInstallment: number
  downInstallmentCount: number
  downInstallmentAmt:   number
  financeInstallments:  number
  monthlyPayment:       number
  financeAmount:        number
  totalSalePrice:       number
}

function fmt(n: number) {
  return n.toLocaleString("th-TH")
}

function PayBar({ down, finance }: { down: number; finance: number }) {
  const total = down + finance
  if (!total) return null
  const downPct = Math.round((down / total) * 100)
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 mt-1.5" title={`ดาวน์ ${downPct}% / ไฟแนนซ์ ${100 - downPct}%`}>
      <div className="bg-amber-400 dark:bg-amber-500" style={{ width: `${downPct}%` }} />
      <div className="bg-blue-400 dark:bg-blue-500 flex-1" />
    </div>
  )
}

const STATUS_CONFIG = {
  contract: { label: "ติดสัญญา", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  active:   { label: "ว่าง",     cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  inactive: { label: "ไม่ใช้งาน", cls: "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400" },
}

const STATUS_TABS = [
  { key: "",         label: "ทั้งหมด" },
  { key: "contract", label: "ติดสัญญา" },
  { key: "active",   label: "ว่าง" },
  { key: "inactive", label: "ไม่ใช้งาน" },
]

export default function PriceListPage() {
  const [rows,    setRows]    = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q,       setQ]       = useState("")
  const [installFilter, setInstallFilter] = useState<number | null>(null)
  const [statusFilter,  setStatusFilter]  = useState("")

  useEffect(() => {
    fetch("/api/price-list")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setRows(data); setLoading(false) })
  }, [])

  const installmentGroups = useMemo(() =>
    Array.from(new Set(rows.map((r) => r.financeInstallments)))
      .sort((a, b) => a - b)
      .map((v) => ({ value: v, count: rows.filter((r) => r.financeInstallments === v).length })),
    [rows]
  )

  const filtered = useMemo(() => {
    let res = rows
    if (statusFilter)        res = res.filter((r) => r.status === statusFilter)
    if (installFilter !== null) res = res.filter((r) => r.financeInstallments === installFilter)
    if (q) res = res.filter((r) => r.licensePlate.toLowerCase().includes(q.toLowerCase()))
    return res
  }, [rows, q, installFilter, statusFilter])

  const totalFleetValue = rows.reduce((s, r) => s + r.totalSalePrice, 0)
  const totalFinance    = rows.reduce((s, r) => s + r.financeAmount, 0)
  const avgMonthly      = rows.length ? Math.round(rows.reduce((s, r) => s + r.monthlyPayment, 0) / rows.length) : 0
  const avgDown         = rows.length ? Math.round(rows.reduce((s, r) => s + r.downPayment, 0) / rows.length) : 0

  const sumTotal    = filtered.reduce((s, r) => s + r.totalSalePrice, 0)
  const sumFinance  = filtered.reduce((s, r) => s + r.financeAmount, 0)
  const sumDown     = filtered.reduce((s, r) => s + r.downPayment, 0)
  const avgMonthlyF = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.monthlyPayment, 0) / filtered.length) : 0

  const contractCount  = rows.filter((r) => r.status === "contract").length
  const availableCount = rows.filter((r) => r.status === "active").length

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="text-xs text-zinc-400 animate-pulse">กำลังโหลดข้อมูล...</div>
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">ข้อมูลอ้างอิงหลัก</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Master Price List</h1>
          <p className="text-xs text-zinc-400 mt-0.5">ราคาขาย / เงินดาวน์ / ค่างวดไฟแนนซ์ ต่อทะเบียนรถ</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />เงินดาวน์</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />ไฟแนนซ์</span>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            icon: <Car className="w-4 h-4 text-zinc-400" />,
            label: "ทะเบียนทั้งหมด",
            value: `${rows.length} คัน`,
            sub: `ติดสัญญา ${contractCount} · ว่าง ${availableCount}`,
            accent: "text-zinc-900 dark:text-zinc-50",
          },
          {
            icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
            label: "มูลค่าฝูงรถรวม",
            value: `฿${fmt(totalFleetValue)}`,
            sub: `จัดไฟแนนซ์ ฿${fmt(totalFinance)}`,
            accent: "text-blue-700 dark:text-blue-400",
          },
          {
            icon: <Banknote className="w-4 h-4 text-amber-500" />,
            label: "เงินดาวน์เฉลี่ย",
            value: `฿${fmt(avgDown)}`,
            sub: `${Math.round((avgDown / (avgDown + (rows.length ? Math.round(totalFinance / rows.length) : 1))) * 100)}% ของราคาขาย`,
            accent: "text-amber-700 dark:text-amber-400",
          },
          {
            icon: <CreditCard className="w-4 h-4 text-violet-500" />,
            label: "ผ่อนเดือนละเฉลี่ย",
            value: `฿${fmt(avgMonthly)}`,
            sub: "ค่าเฉลี่ยทุกสัญญา",
            accent: "text-violet-700 dark:text-violet-400",
          },
        ].map(({ icon, label, value, sub, accent }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-4">
            <div className="flex items-center gap-1.5 mb-2">{icon}<p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p></div>
            <p className={`text-xl font-bold tabular-nums leading-none ${accent}`}>{value}</p>
            {sub && <p className="text-[10px] text-zinc-400 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Status tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">สถานะ</span>
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
              <span className="ml-1 text-[10px] opacity-60">
                ({tab.key === "" ? rows.length : rows.filter((r) => r.status === tab.key).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Installment filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">งวดผ่อน</span>
        <button
          onClick={() => setInstallFilter(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            installFilter === null
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          ทั้งหมด ({rows.length})
        </button>
        {installmentGroups.map(({ value, count }) => (
          <button
            key={value}
            onClick={() => setInstallFilter(installFilter === value ? null : value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              installFilter === value
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
            }`}
          >
            {value} งวด
            <span className={`ml-1.5 text-[10px] ${installFilter === value ? "opacity-80" : "opacity-60"}`}>
              ({count})
            </span>
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-auto">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-semibold text-zinc-500">
            {filtered.length} ทะเบียน
            {(q || installFilter !== null || statusFilter) && (
              <span className="text-zinc-400 font-normal"> (จาก {rows.length})</span>
            )}
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <Input
              placeholder="ค้นหาทะเบียน..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-7 w-48 text-xs pl-8"
            />
          </div>
        </div>

        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            {/* Group row */}
            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/20">
              <th className="px-4 py-2" rowSpan={2} />
              <th
                className="px-3 py-1.5 text-center text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                colSpan={5}
              >
                เงินดาวน์
              </th>
              <th
                className="px-3 py-1.5 text-center text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700"
                colSpan={3}
              >
                ไฟแนนซ์
              </th>
              <th className="px-4 py-1.5 border-l border-zinc-200 dark:border-zinc-700" colSpan={2} />
            </tr>
            {/* Sub-header row */}
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700 min-w-[110px]">
                ทะเบียน
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">เงินดาวน์</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">เงินสด</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">คงเหลือผ่อน</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">งวด</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">ผ่อน/งวด</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-blue-500 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">งวด</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-blue-500 uppercase tracking-wider">ผ่อนเดือนละ</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-blue-500 uppercase tracking-wider">ยอดจัด</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">รวมราคาขาย</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-l border-zinc-200 dark:border-zinc-700">สถานะ</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
            {filtered.map((r) => {
              const downPct = r.totalSalePrice ? Math.round((r.downPayment / r.totalSalePrice) * 100) : 0
              const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.active
              return (
                <tr key={r.licensePlate} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors group">
                  <td className="w-0 p-0" />

                  {/* License plate */}
                  <td className="px-3 py-2 border-l border-zinc-50 dark:border-zinc-800/60">
                    <span className="font-mono text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                      {r.licensePlate}
                    </span>
                  </td>

                  {/* Down section */}
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
                    {fmt(r.downPayment)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {fmt(r.cashDown)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {fmt(r.remainingInstallment)}
                  </td>
                  <td className="px-3 py-2 text-center text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {r.downInstallmentCount}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                    {fmt(r.downInstallmentAmt)}
                  </td>

                  {/* Finance section */}
                  <td className="px-3 py-2 text-center border-l border-zinc-50 dark:border-zinc-800/60">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-bold tabular-nums">
                      {r.financeInstallments}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-blue-700 dark:text-blue-400 font-semibold">
                    {fmt(r.monthlyPayment)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-blue-600 dark:text-blue-300">
                    {fmt(r.financeAmount)}
                  </td>

                  {/* Total */}
                  <td className="px-3 py-2 border-l border-zinc-50 dark:border-zinc-800/60">
                    <div className="text-right text-sm tabular-nums font-bold text-zinc-900 dark:text-zinc-50">
                      {fmt(r.totalSalePrice)}
                    </div>
                    <PayBar down={r.downPayment} finance={r.financeAmount} />
                    <div className="text-right text-[9px] text-zinc-400 mt-0.5 tabular-nums">
                      ดาวน์ {downPct}%
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2 text-center border-l border-zinc-50 dark:border-zinc-800/60">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}>
                      {sc.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Footer totals */}
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40">
                <td className="w-0 p-0" />
                <td className="px-3 py-2.5 text-xs font-semibold text-zinc-500 border-l border-zinc-200 dark:border-zinc-700" colSpan={2}>
                  รวม {filtered.length} คัน
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold text-amber-700 dark:text-amber-400">
                  {fmt(sumDown)}
                </td>
                <td colSpan={3} />
                <td className="px-3 py-2.5 border-l border-zinc-200 dark:border-zinc-700" />
                <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold text-blue-600 dark:text-blue-400">
                  เฉลี่ย {fmt(avgMonthlyF)}
                </td>
                <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold text-blue-600 dark:text-blue-400">
                  {fmt(sumFinance)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums font-bold text-zinc-900 dark:text-zinc-50 border-l border-zinc-200 dark:border-zinc-700">
                  {fmt(sumTotal)}
                </td>
                <td className="border-l border-zinc-200 dark:border-zinc-700" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
