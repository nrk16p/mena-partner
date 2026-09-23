"use client"

import { useState } from "react"

export function LeadForm({ slug }: { slug: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("sending"); setError("")
    const fd = new FormData(e.currentTarget)
    const res = await fetch("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        name: fd.get("name"), phone: fd.get("phone"),
        budgetDown: fd.get("budgetDown") || 0, message: fd.get("message") || "",
        website: fd.get("website") || "",
      }),
    }).catch(() => null)
    if (res?.ok) { setState("done"); return }
    const j = await res?.json().catch(() => ({})) ?? {}
    setError(j.error ?? "ส่งไม่สำเร็จ กรุณาโทรหาเราโดยตรง")
    setState("idle")
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[var(--mena-green-soft)] bg-[var(--mena-paper)] p-6 text-sm">
        <p className="font-medium text-[var(--mena-green)]">ได้รับข้อมูลแล้ว</p>
        <p className="mt-1 text-[var(--mena-ink)]/70">ฝ่ายขายจะติดต่อกลับภายในวันทำการถัดไป</p>
      </div>
    )
  }

  const field = "w-full rounded-xl border border-[var(--mena-line)] px-4 py-2.5 text-sm bg-white placeholder:text-[var(--mena-ink)]/40 focus-visible:outline-2 focus-visible:outline-[var(--mena-green)]"
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--mena-line)] bg-[var(--mena-paper)] p-6 space-y-3">
      <p className="font-medium">ให้ฝ่ายขายติดต่อกลับ</p>
      <p className="text-sm text-[var(--mena-ink)]/60 !mt-1">ฝากชื่อกับเบอร์ไว้ เราโทรกลับพร้อมรายละเอียดรถคันนี้</p>
      <input name="name" required placeholder="ชื่อ-นามสกุล" className={field} />
      <input name="phone" required inputMode="tel" placeholder="เบอร์โทร (เช่น 0812345678)" className={field} />
      <input name="budgetDown" inputMode="numeric" placeholder="เงินดาวน์ที่มี (บาท)" className={field} />
      <textarea name="message" rows={3} placeholder="ข้อความถึงฝ่ายขาย (ไม่บังคับ)" className={field} />
      {/* honeypot — ซ่อนจากคน บอทมักกรอก */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-sm text-[var(--mena-red)]">{error}</p>}
      <button disabled={state === "sending"} className="w-full rounded-full bg-[var(--mena-green)] text-white font-medium py-3 hover:bg-[var(--mena-green-soft)] transition-colors disabled:opacity-50">
        {state === "sending" ? "กำลังส่ง…" : "ส่งข้อมูลให้ฝ่ายขาย"}
      </button>
      <p className="text-xs text-[var(--mena-ink)]/45">ข้อมูลของคุณใช้เพื่อติดต่อกลับเรื่องรถคันนี้เท่านั้น</p>
    </form>
  )
}
