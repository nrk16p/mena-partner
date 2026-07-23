"use client"

import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { LogOut, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { data: session }     = useSession()
  const [isDark, setIsDark]   = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("theme", next ? "dark" : "light") } catch {}
  }

  return (
    <header className="flex items-center justify-end gap-2 h-11 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
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
