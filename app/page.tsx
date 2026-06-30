"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Users, ClipboardList, Truck, BarChart3 } from "lucide-react"
import { formatMoney, formatMonth } from "@/lib/utils"

type Summary = {
  totalDrivers: number
  driversWithEntry: number
  grandNetPay: number
  grandIncome: number
  grandDeductions: number
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function DashboardPage() {
  const month                           = currentMonth()
  const [summary, setSummary]           = useState<Summary | null>(null)
  const [driverCount, setDriverCount]   = useState(0)

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const r = await fetch(`/api/reports/netpay?month=${month}`)
        if (r.ok) {
          const d = await r.json()
          setSummary(d.summary)
        } else {
          setSummary(null)
        }
      } catch {
        setSummary(null)
      }
    }

    const loadDrivers = async () => {
      try {
        const r = await fetch("/api/drivers?status=active")
        if (r.ok) {
          const d = await r.json()
          setDriverCount(Array.isArray(d) ? d.length : 0)
        } else {
          setDriverCount(0)
        }
      } catch {
        setDriverCount(0)
      }
    }

    loadSummary()
    loadDrivers()
  }, [month])

  const QUICK = [
    { href: "/contracts", label: "สัญญาเช่าซื้อ",  icon: FileText,      color: "bg-blue-50 text-blue-600" },
    { href: "/drivers",   label: "พนักงานขับรถ",   icon: Users,         color: "bg-emerald-50 text-emerald-600" },
    { href: "/payroll",   label: "เงินเดือน",       icon: ClipboardList, color: "bg-amber-50 text-amber-600" },
    { href: "/trips",     label: "รายเที่ยว",       icon: Truck,         color: "bg-purple-50 text-purple-600" },
    { href: "/reports",   label: "รายงาน",          icon: BarChart3,     color: "bg-red-50 text-red-600" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">หน้าหลัก</h1>
        <p className="text-sm text-zinc-400 mt-1">{formatMonth(month)}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "รถร่วมทั้งหมด", value: `${driverCount} คัน`,                                   color: "" },
          { label: "รายรับรวม",     value: summary ? formatMoney(summary.grandIncome) : "-",       color: "text-emerald-600" },
          { label: "รายหักรวม",     value: summary ? formatMoney(summary.grandDeductions) : "-",   color: "text-red-500" },
          { label: "สุทธิรวม",      value: summary ? formatMoney(summary.grandNetPay) : "-",       color: "text-zinc-800 dark:text-zinc-100" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4"
          >
            <p className="text-xs text-zinc-400 mb-2">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-500 mb-3 uppercase tracking-wide">เมนูหลัก</h2>
        <div className="grid grid-cols-5 gap-3">
          {QUICK.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-3 p-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 hover:shadow-sm transition-all text-center"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
