"use client"

import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") router.replace("/")
  }, [status, router])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-xs px-8 py-10 bg-white rounded-2xl shadow-xl text-center">
        <h1 className="text-xl font-bold tracking-widest text-emerald-600 uppercase mb-1">Mena Partner</h1>
        <p className="text-xs text-zinc-400 mb-8">ระบบเงินเดือนรถร่วม Mixer</p>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          เข้าสู่ระบบด้วย Google
        </Button>
        <p className="text-[10px] text-zinc-400 mt-4">เฉพาะ @menatransport.co.th เท่านั้น</p>
      </div>
    </div>
  )
}
