"use client"

import { useSession, signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { data: session } = useSession()
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
      <div />
      <div className="flex items-center gap-3">
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
