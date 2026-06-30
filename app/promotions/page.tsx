"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PromoSummaryRow } from "@/types"
import { formatMoney } from "@/lib/utils"

export default function PromotionsPage() {
  const router = useRouter()
  const [rows, setRows]     = useState<PromoSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ]           = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const r = await fetch("/api/promotions")
        if (r.ok) setRows(await r.json())
        else setRows([])
      } catch { setRows([]) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = rows.filter((row) =>
    [row.contractCode, row.licensePlate, row.driverName]
      .some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))
  )

  const activeRows = rows.filter((r) => r.contractCode)
  const totalBudget = activeRows.reduce((s, r) => s + r.repairBudget, 0)
  const totalUsed   = activeRows.reduce((s, r) => s + r.repairUsed, 0)
  const pm1Pending  = activeRows.filter((r) => !r.pm1UsedThisYear).length
  const pm2Pending  = activeRows.filter((r) => !r.pm2UsedThisYear).length
  const budgetAlert = activeRows.filter((r) => r.repairBudget > 0 && r.repairUsed / r.repairBudget >= 0.9).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">โปรโมชั่น ซ่อม+PM</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{rows.length} รถในระบบ</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: "วงเงินซ่อมรวม (โปร 2)",  value: formatMoney(totalBudget),             color: "" },
          { label: "ใช้ไปแล้วรวม",             value: formatMoney(totalUsed),               color: "text-red-500" },
          { label: "คงเหลือรวม",               value: formatMoney(totalBudget - totalUsed), color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: `PM1 ยังไม่ได้ทำ`,          value: `${pm1Pending} คัน`,  color: pm1Pending > 0 ? "text-amber-600" : "text-emerald-600" },
          { label: `PM2 ยังไม่ได้ทำ`,          value: `${pm2Pending} คัน`,  color: pm2Pending > 0 ? "text-amber-600" : "text-emerald-600" },
          { label: "วงเงินซ่อม ≥90%",          value: `${budgetAlert} คัน`, color: budgetAlert > 0 ? "text-red-600" : "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ทะเบียน / ชื่อ"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {q && <span className="text-xs text-zinc-400">พบ {filtered.length} รายการ</span>}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-left">เบอร์รถ</th>
              <th className="px-4 py-3 text-left">ชื่อคนขับ</th>
              <th className="px-4 py-3 text-right">วงเงินโปร 2</th>
              <th className="px-4 py-3 text-right">ใช้ไป</th>
              <th className="px-4 py-3 text-left min-w-[140px]">คงเหลือ</th>
              <th className="px-4 py-3 text-center">PM1</th>
              <th className="px-4 py-3 text-center">PM2</th>
              <th className="px-4 py-3 text-right">งบ PM/ปี</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : filtered.map((row) => {
              const pct = row.repairBudget > 0
                ? Math.min(100, (row.repairUsed / row.repairBudget) * 100)
                : 0
              const barColor = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"
              return (
                <tr
                  key={row.contractCode ?? row.licensePlate}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${row.contractCode ? "cursor-pointer" : "opacity-60"}`}
                  onClick={() => row.contractCode && router.push(`/promotions/${row.contractCode}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs">{row.licensePlate}</td>
                  <td className="px-4 py-3 text-zinc-500">{row.truckNumber}</td>
                  <td className="px-4 py-3">{row.driverName ?? <span className="text-zinc-400 italic text-xs">ไม่ระบุ</span>}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.repairBudget)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatMoney(row.repairUsed)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs w-20 text-right text-zinc-600 dark:text-zinc-400">
                        {formatMoney(row.repairRemaining)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      row.pm1UsedThisYear
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}>
                      {row.pm1UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      row.pm2UsedThisYear
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}>
                      {row.pm2UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600">{formatMoney(row.pmRemainingThisYear)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
