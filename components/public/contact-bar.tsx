"use client"

/**
 * ปุ่มติดต่อฝ่ายขายที่ติดหน้าจอตลอด — มือถือเป็นแถบล่างจอ, จอใหญ่เป็นปุ่มลอยมุมขวาล่าง
 * ยังไม่ได้ตั้งเบอร์/LINE ใน /catalog → ปุ่มพาไปช่องฝากเบอร์ (#ติดต่อ) แทน จะได้ไม่มีปุ่มกดแล้วไม่เกิดอะไร
 */
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { telHref } from "./thai-text"

export function ContactBar({ phone, line }: { phone?: string; line?: string }) {
  const lineHref = line ? `https://line.me/R/ti/p/${encodeURIComponent(line)}` : ""
  const solid = "rounded-full bg-[var(--mena-green)] text-white font-medium px-5 py-3 text-center hover:bg-[var(--mena-green-soft)] transition-colors"
  const ghost = "rounded-full border border-[var(--mena-green)] text-[var(--mena-green)] font-medium px-5 py-3 text-center bg-white hover:bg-[var(--mena-paper)] transition-colors"

  // หน้าสมัครนายหน้า: เป้าหมายคือให้กรอกใบสมัคร ไม่ใช่โทร → ปุ่มหลักพาไปที่ฟอร์ม โทรเป็นปุ่มรอง
  const isApply = usePathname() === "/sales-partner"
  // ฟอร์มอยู่บนจอแล้ว → ซ่อนแถบล่าง ไม่ให้ทับช่องที่กำลังกรอก (WCAG focus not obscured) และไม่ต้องมีปุ่มพาไปฟอร์มอีก
  const [formInView, setFormInView] = useState(false)
  useEffect(() => {
    if (!isApply) return
    const el = document.getElementById("สมัคร")
    if (!el) return
    const io = new IntersectionObserver(([e]) => setFormInView(e.isIntersecting), { rootMargin: "0px 0px -15% 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [isApply])
  const hideBar = isApply && formInView
  const buttons = isApply ? (
    <>
      <a href="#สมัคร" className={`${solid} flex-1 sm:flex-none`}>กรอกใบสมัคร</a>
      {phone && <a href={telHref(phone)} className={`${ghost} sm:flex-none`}>โทร</a>}
    </>
  ) : phone || line ? (
    <>
      {phone && <a href={telHref(phone)} className={`${solid} flex-1 sm:flex-none`}>โทรหาฝ่ายขาย</a>}
      {line && <a href={lineHref} className={`${ghost} flex-1 sm:flex-none`}>ทักทาง LINE</a>}
    </>
  ) : (
    <a href="#ติดต่อ" className={`${solid} flex-1 sm:flex-none`}>ให้ฝ่ายขายติดต่อกลับ</a>
  )

  return (
    <>
      {/* มือถือ: แถบล่างจอ */}
      <div className={`lg:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 motion-reduce:transition-none ${hideBar ? "translate-y-full" : ""} border-t border-[var(--mena-line)] bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`} aria-hidden={hideBar} inert={hideBar}>
        <div className="flex gap-2">{buttons}</div>
      </div>
      {/* จอใหญ่: ปุ่มลอยมุมขวาล่าง */}
      <div className={`${hideBar ? "lg:hidden" : "lg:flex"} hidden fixed right-6 bottom-6 z-40 gap-2 shadow-[0_18px_40px_-20px_rgba(2,58,30,0.6)] rounded-full`}>
        {buttons}
      </div>
    </>
  )
}
