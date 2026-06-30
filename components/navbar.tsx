"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { LogOut, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { data: session }     = useSession()
  const [criticalCount, setCriticalCount] = useState(0)

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.ok ? r.json() : [])
      .then((alerts: Array<{ severity: string }>) => {
        setCriticalCount(alerts.filter((a) => a.severity === "critical").length)
      })
      .catch(() => {})
  }, [])

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        {criticalCount > 0 && (
          <Link href="/" className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="font-semibold">{criticalCount} critical</span>
          </Link>
        )}
        {session?.user && (
          <span className="text-xs text-zinc-500">{session.user.name ?? session.user.email}</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
