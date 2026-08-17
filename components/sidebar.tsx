"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FileText, Users, ShieldCheck, Home, Upload, Settings, Tag, Truck, Wrench,
  ClipboardList, Banknote, BarChart3, SlidersHorizontal, Receipt, BadgeCheck, HandCoins, Fuel, CalendarCheck, BookOpenCheck, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { statusOf, STATUS_META } from "@/lib/module-status"

// จัดหมวดเป็น 3 ระบบหลัก: สัญญา · โปรโมชั่น · เงินเดือน (ปรับตามคำสั่ง 2026-08-05)
const GROUPS: { title: string | null; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; hint?: string; adminOnly?: boolean }[] }[] = [
  {
    title: null,
    items: [{ href: "/", label: "หน้าหลัก · คู่มือ", icon: Home }],
  },
  {
    title: "ระบบสัญญา",
    items: [
      { href: "/drivers", label: "คนขับ", icon: Users, hint: "บัตร ปชช. / วันเกิด / ที่อยู่ / บัญชี" },
      { href: "/vehicles", label: "รถ", icon: Truck, hint: "ยี่ห้อ รุ่น เลขตัวถัง เลขเครื่อง" },
      { href: "/price-list", label: "ราคาขาย", icon: Tag, hint: "เพิ่ม/แก้ไขได้ในหน้า" },
      { href: "/contracts", label: "สัญญา", icon: FileText },
    ],
  },
  {
    title: "ระบบขาย",
    items: [
      { href: "/quotations", label: "สร้างใบเสนอราคา", icon: Receipt },
      { href: "/quotations/commission", label: "ยอดขาย & ค่าคอม", icon: HandCoins, hint: "ขายกี่คัน ได้คอมเท่าไหร่" },
      { href: "/quotations/sales-people", label: "ทีมขาย", icon: Users, hint: "ชื่อ / email / เบอร์โทร พนักงานขาย", adminOnly: true },
    ],
  },
  {
    title: "ระบบโปรโมชั่น",
    items: [
      { href: "/promotions", label: "โปรโมชั่น", icon: ShieldCheck },
      { href: "/reports/promotions", label: "รายงานสรุปยอดโปรโมชั่น", icon: Receipt },
    ],
  },
  {
    title: "ระบบเงินเดือน",
    items: [
      { href: "/vehicle-cost", label: "ค่าใช้จ่ายรถ", icon: Wrench },
      { href: "/insurance-tax", label: "ภาษี & ประกันภัย", icon: BadgeCheck },
      { href: "/trip-fuel", label: "ค่าเที่ยว & เชื้อเพลิง", icon: Fuel },
      { href: "/attendance", label: "วันทำงาน พจร.", icon: CalendarCheck },
      { href: "/payroll-extras", label: "รับ-หักอื่นๆ", icon: SlidersHorizontal },
      { href: "/payroll", label: "เงินเดือน", icon: Banknote },
      { href: "/payroll/sop", label: "SOP/WI ปิดงวด", icon: BookOpenCheck },
      { href: "/driver-ledger", label: "หนี้สิน & เงินสะสม", icon: HandCoins },
      { href: "/adjustments", label: "รายการปรับปรุง", icon: SlidersHorizontal },
      { href: "/reports", label: "รายงาน", icon: BarChart3 },
    ],
  },
]

const ADMIN_NAV = [
  { href: "/import", label: "นำเข้า Excel", icon: Upload },
  { href: "/admin/month", label: "จัดการรอบเดือน", icon: Settings },
]

function NavLink({ href, label, icon: Icon, active, hint }: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  hint?: string
}) {
  const status = statusOf(href)
  const meta = STATUS_META[status]
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-[8px] rounded-lg text-sm transition-colors relative",
        active
          ? "gold-grad text-[#031B14] font-semibold shadow-sm"
          : "text-emerald-50/85 hover:bg-[#C9A227]/15 hover:text-[#E7C86E]"
      )}
      title={hint ? `${label} — ${hint}` : meta.label}
    >
      <Icon className={cn("w-4 h-4 shrink-0", active ? "text-[#031B14]" : "text-[#C9A227]/70")} />
      <span className="truncate min-w-0 flex-1">{label}</span>
      {status !== "ready" && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", meta.dot)} />
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role ?? ""
  const isAdmin = ["admin", "superadmin"].includes(role)
  const isSales = role === "salesperson"

  const initial = (session?.user?.email ?? session?.user?.name ?? "?")[0].toUpperCase()
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  // accordion: จำสถานะพับ/กางใน localStorage + กางหมวดของหน้าปัจจุบันเสมอ
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sidebar-groups") ?? "{}") as Record<string, boolean>
      setOpenGroups(saved)
    } catch { /* ค่าเสีย — ใช้ default กางหมด */ }
  }, [])
  useEffect(() => {
    const active = GROUPS.find((g) => g.title && g.items.some((i) => isActive(i.href)))?.title
    if (active) setOpenGroups((prev) => (prev[active] === false ? { ...prev, [active]: true } : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !(prev[title] ?? false) }
      try { localStorage.setItem("sidebar-groups", JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }

  return (
    <aside className="flex flex-col w-56 shrink-0 green-grad h-screen border-r border-[#0A3328]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-[18px] border-b border-[#C9A227]/25 shrink-0">
        <div className="w-7 h-7 rounded-lg gold-grad flex items-center justify-center text-[#031B14] font-bold text-sm shrink-0">
          M
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#E7C86E] tracking-widest leading-tight">MENA PARTNER</p>
          <p className="text-xs text-emerald-100/50 leading-tight mt-0.5">รถร่วม Mixer</p>
        </div>
      </div>

      {/* Grouped nav — accordion: พับ/กางรายหมวด จำสถานะไว้ และกางหมวดของหน้าปัจจุบันอัตโนมัติ */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {GROUPS.map((g0, gi) => {
          const visible = g0.items.filter((it) => !it.adminOnly || isAdmin)
          // ฝ่ายขาย: เหลือเฉพาะ ราคาขาย + ใบเสนอราคา
          const g = isSales
            ? { ...g0, items: visible.filter((it) => it.href === "/price-list" || it.href === "/quotations" || it.href === "/quotations/commission") }
            : { ...g0, items: visible }
          if (g.title && g.items.length === 0) return null
          if (!g.title) {
            return (
              <div key={gi} className="px-2">
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <NavLink key={item.href} {...item} active={isActive(item.href)} />
                  ))}
                </div>
              </div>
            )
          }
          const hasActive = g.items.some((item) => isActive(item.href))
          const open = openGroups[g.title] ?? false // default พับทุกหมวด (คำสั่ง 2026-08-06)
          return (
            <div key={gi} className="px-2 mt-3">
              <button
                type="button"
                onClick={() => toggleGroup(g.title!)}
                className="w-full flex items-center justify-between px-3 mb-1 text-sm font-semibold text-[#C9A227] hover:text-[#E7C86E] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  {g.title}
                  {!open && hasActive && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", !open && "-rotate-90")} />
              </button>
              {open && (
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <NavLink key={item.href} {...item} active={isActive(item.href)} />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-3 px-2">
            <button
              type="button"
              onClick={() => toggleGroup("Admin")}
              className="w-full flex items-center justify-between px-3 mb-1 text-sm font-semibold text-[#C9A227] hover:text-[#E7C86E] transition-colors"
            >
              <span>Admin</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", !(openGroups["Admin"] ?? false) && "-rotate-90")} />
            </button>
            {(openGroups["Admin"] ?? false) && (
              <div className="space-y-0.5">
                {ADMIN_NAV.map((item) => (
                  <NavLink key={item.href} {...item} active={isActive(item.href)} />
                ))}
                {role === "superadmin" && (
                  <NavLink href="/admin/users" label="ผู้ใช้ & สิทธิ์" icon={Users} active={isActive("/admin/users")} />
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom user chip */}
      {session?.user && (
        <div className="px-4 py-3 border-t border-[#C9A227]/25 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[#C9A227]/25 flex items-center justify-center text-[10px] font-bold text-[#E7C86E] shrink-0">
              {initial}
            </div>
            <p className="text-xs text-emerald-100/50 truncate min-w-0">
              {session.user.email ?? session.user.name}
            </p>
          </div>
        </div>
      )}
    </aside>
  )
}
