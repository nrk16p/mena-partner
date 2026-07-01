"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PromoDetail, RepairClaim, PmRecord } from "@/types"
import { formatMoney } from "@/lib/utils"

export default function PromoDetailPage() {
  const { contractCode } = useParams<{ contractCode: string }>()
  const router = useRouter()
  const [data, setData]     = useState<PromoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [repairMonthly, setRepairMonthly] = useState<Record<string, number | string> | null>(null)

  const [rDate, setRDate]   = useState("")
  const [rDesc, setRDesc]   = useState("")
  const [rAmt, setRAmt]     = useState("")
  const [rSaving, setRSaving] = useState(false)

  const currentYear = new Date().getFullYear()
  const [pmYear, setPmYear]   = useState(String(currentYear))
  const [pmType, setPmType]   = useState<"PM1" | "PM2">("PM1")
  const [pmDate, setPmDate]   = useState("")
  const [pmAmt, setPmAmt]     = useState("")
  const [pmNotes, setPmNotes] = useState("")
  const [pmSaving, setPmSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [promoRes, repairRes] = await Promise.all([
        fetch(`/api/promotions/${contractCode}`),
        fetch(`/api/repair-monthly/${contractCode}`),
      ])
      if (promoRes.ok) setData(await promoRes.json())
      else setData(null)
      if (repairRes.ok) {
        const rm = await repairRes.json()
        setRepairMonthly(rm)
      }
    } catch { setData(null) }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load() }, [contractCode])

  const handleRepairSave = async () => {
    if (!rDate || !rDesc || !rAmt) return
    setRSaving(true)
    try {
      const r = await fetch("/api/promotions/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractCode, date: rDate, description: rDesc, amount: Number(rAmt) }),
      })
      if (r.ok) { setRDate(""); setRDesc(""); setRAmt(""); await load() }
    } catch {} finally { setRSaving(false) }
  }

  const handleRepairDelete = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return
    const r = await fetch(`/api/promotions/repair/${id}`, { method: "DELETE" })
    if (r.ok) await load()
  }

  const handlePmSave = async () => {
    if (!pmDate || !pmAmt) return
    setPmSaving(true)
    try {
      const r = await fetch("/api/promotions/pm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractCode, year: Number(pmYear), type: pmType, date: pmDate, amount: Number(pmAmt), notes: pmNotes }),
      })
      if (r.ok) { setPmDate(""); setPmAmt(""); setPmNotes(""); await load() }
    } catch {} finally { setPmSaving(false) }
  }

  const handlePmDelete = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return
    const r = await fetch(`/api/promotions/pm/${id}`, { method: "DELETE" })
    if (r.ok) await load()
  }

  if (loading) return <div className="text-zinc-400 text-sm py-8">กำลังโหลด...</div>
  if (!data)   return <div className="text-zinc-400 text-sm py-8">ไม่พบข้อมูล</div>

  const repairPct = data.repairBudget > 0 ? Math.min(100, (data.repairUsed / data.repairBudget) * 100) : 0
  const pmPct     = data.annualPmCap > 0  ? Math.min(100, (data.pmUsedThisYear / data.annualPmCap) * 100) : 0
  const repairBarColor = repairPct >= 90 ? "bg-red-500" : repairPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
  const pmBarColor     = pmPct >= 90     ? "bg-red-500" : pmPct >= 60     ? "bg-amber-500" : "bg-blue-500"

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 mb-3">
          <ArrowLeft className="w-3 h-3" /> กลับ
        </button>
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
          {data.driverName || data.contractCode}
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          {data.contractCode} · {data.licensePlate} · {data.truckNumber}
        </p>
      </div>

      {/* ─── Promo 2: Repair Budget ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          โปร 2 — วงเงินค่าซ่อมตลอดสัญญา
        </h2>

        {/* Budget bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-zinc-600">
            <span>ใช้ไป <span className="font-semibold text-red-500">{formatMoney(data.repairUsed)}</span></span>
            <span>วงเงิน {formatMoney(data.repairBudget)}</span>
          </div>
          <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${repairBarColor}`} style={{ width: `${repairPct}%` }} />
          </div>
          <p className="text-sm text-right text-zinc-500">
            คงเหลือ <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatMoney(data.repairRemaining)}</span>
          </p>
        </div>

        {/* Repair monthly breakdown from Excel */}
        {repairMonthly && (repairMonthly.totalRepair as number) > 0 && (
          <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-lg px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">ค่าซ่อมจริง — {repairMonthly.month as string}</p>
            <div className="grid grid-cols-4 gap-3">
              {([
                ["ค่าอะไหล่", repairMonthly.partsAmount as number, "text-zinc-700"],
                ["ยาง", repairMonthly.tireAmount as number, "text-zinc-700"],
                ["ค่าแรง", repairMonthly.laborAmount as number, "text-zinc-700"],
                ["รวม", repairMonthly.totalRepair as number, "text-red-500 font-bold"],
              ] as [string, number, string][]).map(([label, val, cls]) => (
                <div key={label}>
                  <p className="text-[10px] text-zinc-400 mb-0.5">{label}</p>
                  <p className={`text-sm ${cls}`}>{val ? val.toLocaleString("th-TH", { maximumFractionDigits: 0 }) : "0"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Repair history */}
        <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">วันที่</th>
                <th className="px-3 py-2 text-left">รายละเอียด</th>
                <th className="px-3 py-2 text-right">ยอด</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.repairClaims.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-zinc-400 text-xs">ยังไม่มีรายการซ่อม</td></tr>
              ) : data.repairClaims.map((c: RepairClaim) => (
                <tr key={c._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2 text-zinc-500">{c.date}</td>
                  <td className="px-3 py-2">{c.description}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(c.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleRepairDelete(c._id!)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add repair form */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">บันทึกการซ่อม</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">วันที่ซ่อม</Label>
              <Input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">รายละเอียด</Label>
              <Input placeholder="เช่น เปลี่ยนปะเก็น" value={rDesc} onChange={(e) => setRDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ยอด (บาท)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0" value={rAmt} onChange={(e) => setRAmt(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={handleRepairSave}
            disabled={rSaving || !rDate || !rDesc || !rAmt}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {rSaving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>

      {/* ─── Promo 3: PM ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            โปร 3 — PM เชิงป้องกัน (รีเซ็ตทุก 1 ม.ค.)
          </h2>
          <div className="flex gap-2">
            {(["PM1","PM2"] as const).map((t) => {
              const used = t === "PM1" ? data.pm1UsedThisYear : data.pm2UsedThisYear
              return (
                <span key={t} className={`text-xs px-3 py-1 rounded-full font-medium ${used ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
                  {t}: {used ? "ใช้แล้ว" : "ยังไม่ได้ใช้"}
                </span>
              )
            })}
          </div>
        </div>

        {/* PM budget bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-zinc-600">
            <span>ใช้ปีนี้ <span className="font-semibold text-blue-500">{formatMoney(data.pmUsedThisYear)}</span></span>
            <span>เพดาน {formatMoney(data.annualPmCap)}</span>
          </div>
          <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pmBarColor}`} style={{ width: `${pmPct}%` }} />
          </div>
          <p className="text-sm text-right text-zinc-500">
            คงเหลือปีนี้ <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatMoney(data.pmRemainingThisYear)}</span>
          </p>
        </div>

        {/* PM history */}
        <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">ปี</th>
                <th className="px-3 py-2 text-left">ประเภท</th>
                <th className="px-3 py-2 text-left">วันที่</th>
                <th className="px-3 py-2 text-right">ยอด</th>
                <th className="px-3 py-2 text-left">หมายเหตุ</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.pmRecords.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-zinc-400 text-xs">ยังไม่มีบันทึก PM</td></tr>
              ) : data.pmRecords.map((p: PmRecord) => (
                <tr key={p._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2 text-zinc-500">{p.year}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type === "PM1" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{p.date}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(p.amount)}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">{p.notes}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handlePmDelete(p._id!)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add PM form */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">บันทึก PM</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">ปี (ค.ศ.)</Label>
              <Input type="number" value={pmYear} onChange={(e) => setPmYear(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ประเภท</Label>
              <select
                value={pmType}
                onChange={(e) => setPmType(e.target.value as "PM1" | "PM2")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="PM1">PM1</option>
                <option value="PM2">PM2</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">วันที่ทำ PM</Label>
              <Input type="date" value={pmDate} onChange={(e) => setPmDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ยอด (บาท)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0" value={pmAmt} onChange={(e) => setPmAmt(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">หมายเหตุ</Label>
              <Input placeholder="หมายเหตุ (ถ้ามี)" value={pmNotes} onChange={(e) => setPmNotes(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={handlePmSave}
            disabled={pmSaving || !pmDate || !pmAmt}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {pmSaving ? "กำลังบันทึก..." : "บันทึก PM"}
          </Button>
        </div>
      </div>
    </div>
  )
}
