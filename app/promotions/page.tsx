"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PromoSummaryRow } from "@/types"
import { formatMoney } from "@/lib/utils"

export default function PromotionsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<PromoSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")

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
      .some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">โปรโมชั่น ซ่อม+PM</h1>
      </div>

      <input
        className="border rounded px-3 py-1.5 text-sm w-72"
        placeholder="ค้นหา รหัส / ทะเบียน / ชื่อ"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">ทะเบียน</th>
              <th className="text-left px-3 py-2">เบอร์รถ</th>
              <th className="text-left px-3 py-2">ชื่อคนขับ</th>
              <th className="text-right px-3 py-2">โปร 2 วงเงิน</th>
              <th className="text-right px-3 py-2">ใช้ไป</th>
              <th className="text-left px-3 py-2 min-w-[140px]">คงเหลือ</th>
              <th className="text-center px-3 py-2">PM1</th>
              <th className="text-center px-3 py-2">PM2</th>
              <th className="text-right px-3 py-2">งบ PM คงเหลือ/ปี</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</td></tr>
            ) : filtered.map((row) => {
              const pct = row.repairBudget > 0
                ? Math.min(100, (row.repairUsed / row.repairBudget) * 100)
                : 0
              return (
                <tr
                  key={row.contractCode}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/promotions/${row.contractCode}`)}
                >
                  <td className="px-3 py-2 font-mono">{row.licensePlate}</td>
                  <td className="px-3 py-2">{row.truckNumber}</td>
                  <td className="px-3 py-2">{row.driverName}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.repairBudget)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.repairUsed)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs w-20 text-right">{formatMoney(row.repairRemaining)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.pm1UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {row.pm1UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้ใช้"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.pm2UsedThisYear ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {row.pm2UsedThisYear ? "ใช้แล้ว" : "ยังไม่ได้ใช้"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{formatMoney(row.pmRemainingThisYear)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
