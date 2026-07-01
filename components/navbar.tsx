"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { LogOut, AlertCircle, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { data: session }     = useSession()
  const [criticalCount, setCriticalCount] = useState(0)
  const [isDark, setIsDark]   = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.ok ? r.json() : [])
      .then((alerts: Array<{ severity: string }>) => {
        setCriticalCount(alerts.filter((a) => a.severity === "critical").length)
      })
      .catch(() => {})
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("theme", next ? "dark" : "light") } catch {}
  }

  return (
    <header className="flex items-center justify-end gap-2 h-11 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
      {criticalCount > 0 && (
        <Link
          href="/"
          className="flex items-center gap-1.5 mr-2 text-[11px] font-semibold text-red-600 hover:text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-2 py-1"
        >
          <AlertCircle className="w-3 h-3" />
          {criticalCount} critical
        </Link>
      )}
      {session?.user && (
        <span className="text-[11px] text-zinc-400 mr-1 hidden sm:block truncate max-w-[180px]">
          {session.user.email ?? session.user.name}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        title={isDark ? "สลับโหมดสว่าง" : "สลับโหมดมืด"}
      >
        {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        title="ออกจากระบบ"
      >
        <LogOut className="w-3.5 h-3.5" />
      </Button>
    </header>
  )
}
