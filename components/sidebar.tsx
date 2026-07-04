"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Users, ShieldCheck, Home, Upload, Settings, Tag, Truck, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"

const NAV = [
  { href: "/",           label: "หน้าหลัก",      icon: Home },
  { href: "/contracts",  label: "สัญญาเช่าซื้อ",  icon: FileText },
  { href: "/drivers",    label: "พนักงานขับรถ",   icon: Users },
  { href: "/promotions", label: "โปรโมชั่น",      icon: ShieldCheck },
  { href: "/price-list", label: "ราคาขาย",        icon: Tag },
  { href: "/vehicles",      label: "ทะเบียนรถ",      icon: Truck },
  { href: "/vehicle-cost", label: "ค่าใช้จ่ายรถ",  icon: Wrench },
]

const ADMIN_NAV = [
  { href: "/import",       label: "นำเข้า Excel",   icon: Upload },
  { href: "/admin/month",  label: "จัดการรอบเดือน", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"

  const initial = (session?.user?.email ?? session?.user?.name ?? "?")[0].toUpperCase()

  return (
    <aside className="flex flex-col w-52 shrink-0 bg-zinc-900 h-screen border-r border-zinc-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-[18px] border-b border-zinc-800 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          M
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-white tracking-widest leading-tight">MENA PARTNER</p>
          <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">รถร่วม Mixer</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="space-y-0.5 px-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-[9px] rounded-lg text-[13px] transition-colors relative",
                  active
                    ? "bg-zinc-800 text-white font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-r before:bg-emerald-500"
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                )}
              >
                <Icon className={cn("w-[15px] h-[15px] shrink-0", active ? "text-emerald-400" : "text-zinc-500")} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-4 px-2">
            <p className="px-3 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
              Admin
            </p>
            <div className="space-y-0.5">
              {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-[9px] rounded-lg text-[13px] transition-colors relative",
                      active
                        ? "bg-zinc-800 text-white font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-r before:bg-emerald-500"
                        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                    )}
                  >
                    <Icon className={cn("w-[15px] h-[15px] shrink-0", active ? "text-emerald-400" : "text-zinc-500")} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom user chip */}
      {session?.user && (
        <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
              {initial}
            </div>
            <p className="text-[11px] text-zinc-500 truncate min-w-0">
              {session.user.email ?? session.user.name}
            </p>
          </div>
        </div>
      )}
    </aside>
  )
}
