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
    <div
      className="fixed inset-0 bg-zinc-950 bg-cover bg-center"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      {/* กล่อง login วางในกรอบว่างด้านขวา (จอกว้าง) / กลางจอ (มือถือ) */}
      <div className="absolute inset-0 flex items-center justify-center md:justify-end md:pr-[11%]">
        <div className="w-full max-w-sm mx-6 rounded-[22px] border border-amber-400/40 bg-black/55 px-9 py-11 text-center shadow-2xl backdrop-blur-md ring-1 ring-white/5">
          <h1 className="mb-1 text-2xl font-bold uppercase tracking-[0.25em] text-emerald-400">
            Mena Partner
          </h1>
          <p className="mb-9 text-xs tracking-wide text-zinc-300">ระบบเงินเดือนรถร่วม Mixer</p>
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            เข้าสู่ระบบด้วย Google
          </Button>
          <p className="mt-4 text-[10px] text-zinc-400">เฉพาะ @menatransport.co.th เท่านั้น</p>
        </div>
      </div>
    </div>
  )
}
