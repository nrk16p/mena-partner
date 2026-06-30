"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Users, ClipboardList, Truck, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/",          label: "หน้าหลัก",      icon: BarChart3 },
  { href: "/contracts", label: "สัญญาเช่าซื้อ",  icon: FileText },
  { href: "/drivers",   label: "พนักงานขับรถ",   icon: Users },
  { href: "/payroll",   label: "เงินเดือน",       icon: ClipboardList },
  { href: "/trips",     label: "รายเที่ยว",       icon: Truck },
  { href: "/reports",   label: "รายงาน",          icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="flex flex-col w-56 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-screen overflow-y-auto">
      <div className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-sm font-bold tracking-widest text-emerald-600 uppercase">Mena Partner</h1>
        <p className="text-[10px] text-zinc-400 mt-0.5">รถร่วม Mixer</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
