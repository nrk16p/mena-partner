"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PromoDetail, RepairClaim, PmRecord } from "@/types"
import { formatMoney } from "@/lib/utils"

export default function PromoDetailPage() {
  const { contractCode } = useParams<{ contractCode: string }>()
  const [data, setData] = useState<PromoDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Repair form state
  const [rDate, setRDate] = useState("")
  const [rDesc, setRDesc] = useState("")
  const [rAmt, setRAmt] = useState("")
  const [rSaving, setRSaving] = useState(false)

  // PM form state
  const currentYear = new Date().getFullYear()
  const [pmYear, setPmYear] = useState(String(currentYear))
  const [pmType, setPmType] = useState<"PM1" | "PM2">("PM1")
  const [pmDate, setPmDate] = useState("")
  const [pmAmt, setPmAmt] = useState("")
  const [pmNotes, setPmNotes] = useState("")
  const [pmSaving, setPmSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/promotions/${contractCode}`)
      if (r.ok) setData(await r.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }

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
    try {
      const r = await fetch(`/api/promotions/repair/${id}`, { method: "DELETE" })
      if (r.ok) await load()
    } catch {}
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
    try {
      const r = await fetch(`/api/promotions/pm/${id}`, { method: "DELETE" })
      if (r.ok) await load()
    } catch {}
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
  if (!data) return <div className="p-8 text-center text-muted-foreground">ไม่พบข้อมูล</div>

  const repairPct = data.repairBudget > 0 ? Math.min(100, (data.repairUsed / data.repairBudget) * 100) : 0
  const pmPct = data.annualPmCap > 0 ? Math.min(100, (data.pmUsedThisYear / data.annualPmCap) * 100) : 0

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{data.driverName || data.contractCode}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.contractCode} · {data.licensePlate} · {data.truckNumber}
        </p>
      </div>

      {/* Section 1: Promo 2 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">โปร 2 — ค่าซ่อมบำรุง (ตลอดสัญญา)</h2>

        {/* Budget bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>ใช้ไป {formatMoney(data.repairUsed)}</span>
            <span>วงเงิน {formatMoney(data.repairBudget)}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${repairPct >= 90 ? "bg-red-500" : repairPct >= 60 ? "bg-amber-500" : "bg-green-500"}`}
              style={{ width: `${repairPct}%` }}
            />
          </div>
          <p className="text-sm text-right">คงเหลือ <span className="font-semibold">{formatMoney(data.repairRemaining)}</span></p>
        </div>

        {/* Repair claims table */}
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">วันที่</th>
                <th className="text-left px-3 py-2">รายละเอียด</th>
                <th className="text-right px-3 py-2">ยอด</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.repairClaims.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">ยังไม่มีรายการซ่อม</td></tr>
              ) : data.repairClaims.map((c: RepairClaim) => (
                <tr key={c._id} className="border-t">
                  <td className="px-3 py-2">{c.date}</td>
                  <td className="px-3 py-2">{c.description}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(c.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleRepairDelete(c._id!)} className="text-red-500 hover:text-red-700 text-xs">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add repair form */}
        <div className="border rounded p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">บันทึกการซ่อม</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">วันที่ซ่อม</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={rDate} onChange={e => setRDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">รายละเอียด</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="เช่น เปลี่ยนปะเก็น" value={rDesc} onChange={e => setRDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ยอด (บาท)</label>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="0" value={rAmt} onChange={e => setRAmt(e.target.value)} />
            </div>
          </div>
          <button
            onClick={handleRepairSave}
            disabled={rSaving || !rDate || !rDesc || !rAmt}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {rSaving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </section>

      {/* Section 2: Promo 3 PM */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">โปร 3 — PM เชิงป้องกัน (รายปี รีเซ็ตทุก 1 ม.ค.)</h2>

        {/* Coupon badges */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">PM1 ปีนี้:</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${data.pm1UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {data.pm1UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้ใช้"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">PM2 ปีนี้:</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${data.pm2UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {data.pm2UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้ใช้"}
            </span>
          </div>
        </div>

        {/* Annual budget bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>ใช้ไปปีนี้ {formatMoney(data.pmUsedThisYear)}</span>
            <span>เพดานปี {formatMoney(data.annualPmCap)}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pmPct >= 90 ? "bg-red-500" : pmPct >= 60 ? "bg-amber-500" : "bg-blue-500"}`}
              style={{ width: `${pmPct}%` }}
            />
          </div>
          <p className="text-sm text-right">คงเหลือปีนี้ <span className="font-semibold">{formatMoney(data.pmRemainingThisYear)}</span></p>
        </div>

        {/* PM history table */}
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">ปี</th>
                <th className="text-left px-3 py-2">ประเภท</th>
                <th className="text-left px-3 py-2">วันที่</th>
                <th className="text-right px-3 py-2">ยอด</th>
                <th className="text-left px-3 py-2">หมายเหตุ</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.pmRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">ยังไม่มีบันทึก PM</td></tr>
              ) : data.pmRecords.map((p: PmRecord) => (
                <tr key={p._id} className="border-t">
                  <td className="px-3 py-2">{p.year}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type === "PM1" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">{p.date}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(p.amount)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.notes}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handlePmDelete(p._id!)} className="text-red-500 hover:text-red-700 text-xs">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add PM form */}
        <div className="border rounded p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">บันทึก PM</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">ปี (คริสต์ศักราช)</label>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={pmYear} onChange={e => setPmYear(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ประเภท</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={pmType} onChange={e => setPmType(e.target.value as "PM1" | "PM2")}>
                <option value="PM1">PM1</option>
                <option value="PM2">PM2</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">วันที่ทำ PM</label>
              <input type="date" className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={pmDate} onChange={e => setPmDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ยอด (บาท)</label>
              <input type="number" className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="0" value={pmAmt} onChange={e => setPmAmt(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">หมายเหตุ</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="หมายเหตุ (ถ้ามี)" value={pmNotes} onChange={e => setPmNotes(e.target.value)} />
            </div>
          </div>
          <button
            onClick={handlePmSave}
            disabled={pmSaving || !pmDate || !pmAmt}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm disabled:opacity-50"
          >
            {pmSaving ? "กำลังบันทึก..." : "บันทึก PM"}
          </button>
        </div>
      </section>
    </div>
  )
}
