"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

/**
 * รูปในการ์ดรถ — โชว์ shimmer ระหว่างโหลด (ไม่ใช่กล่องว่าง) แล้วค่อยเฟดรูปขึ้น
 * ขอรูปแค่ขนาดที่การ์ดใช้จริง (≈360px ต่อคอลัมน์บนจอใหญ่) ไม่ขอเกินขนาดที่แสดง
 * รูปแนวตั้ง (ถ่ายจากมือถือ) ใช้ object-contain ไม่ให้ตัดหัว/ท้ายรถ
 * รูปเสีย (ลิงก์ 404) → ขึ้น "รูปกำลังอัปเดต" แทน ไม่ค้าง "กำลังโหลดรูป…" ตลอดไป (2026-11-13)
 * รูปที่โหลดเสร็จก่อน hydrate (มีใน cache) onLoad จะไม่ยิง — เช็ก img.complete ตอน mount ด้วย
 */
export function CardPhoto({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [portrait, setPortrait] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  const settle = (img: HTMLImageElement) => {
    if (img.naturalWidth === 0) { setFailed(true); return }
    setPortrait(img.naturalHeight > img.naturalWidth)
    setLoaded(true)
  }

  useEffect(() => {
    const img = ref.current
    if (img?.complete) settle(img)
  }, [src])

  if (failed) {
    return <div className="absolute inset-0 grid place-items-center text-sm text-[var(--mena-ink)]/40">รูปกำลังอัปเดต</div>
  }
  return (
    <>
      {!loaded && (
        <div aria-hidden className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,var(--mena-paper)_35%,#fff_50%,var(--mena-paper)_65%)] bg-[length:200%_100%] grid place-items-center">
          <span className="text-xs text-[var(--mena-ink)]/35">กำลังโหลดรูป…</span>
        </div>
      )}
      <Image
        ref={ref}
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) 50vw, 360px"
        priority={priority}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={(e) => settle(e.currentTarget)}
        onError={() => setFailed(true)}
        className={`${portrait ? "object-contain" : "object-cover"} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  )
}
