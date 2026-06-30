"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { PlusCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Contract } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน", completed: "สิ้นสุด", terminated: "ยกเลิก"
}
const STATUS_COLOR: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  completed:  "bg-blue-100 text-blue-700",
  terminated: "bg-red-100 text-red-700",
}

export default function ContractsPage() {
  const { data: session } = useSession()
  const [items, setItems]   = useState<Contract[]>([])
  const [q, setQ]           = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/contracts?q=${encodeURIComponent(q)}`)
        if (res.ok) setItems(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">สัญญาเช่าซื้อ</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{items.length} สัญญา</p>
        </div>
        {session?.user?.role === "admin" && (
          <Link href="/contracts/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="w-4 h-4 mr-2" /> เพิ่มสัญญา
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-zinc-400" />
        <Input
          placeholder="ค้นหา รหัส / ชื่อ / ทะเบียน"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">รหัส</th>
              <th className="px-4 py-3 text-left">ชื่อผู้เช่าซื้อ</th>
              <th className="px-4 py-3 text-left">ชื่อผู้ขับขี่</th>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-left">แพล้นท์</th>
              <th className="px-4 py-3 text-left">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">กำลังโหลด...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
            ) : items.map((c) => (
              <tr key={c._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <Link href={`/contracts/${c._id}`} className="text-emerald-600 hover:underline font-medium">
                    {c.contractCode}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.buyerName}</td>
                <td className="px-4 py-3 text-zinc-500">{c.driverName}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.licensePlate}</td>
                <td className="px-4 py-3 text-zinc-500">{c.plant}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
