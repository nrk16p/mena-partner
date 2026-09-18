"use client"

import { useState } from "react"
import Image from "next/image"

export function TruckGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const list = photos.filter(Boolean)
  const [i, setI] = useState(0)
  if (list.length === 0) {
    return <div className="aspect-[4/3] rounded-2xl bg-zinc-100 grid place-items-center text-zinc-400">รูปกำลังอัปเดต</div>
  }
  return (
    <div>
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100">
        <Image src={list[i]} alt={alt} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" priority />
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 mt-3">
          {list.map((p, idx) => (
            <button key={p} type="button" onClick={() => setI(idx)} aria-label={`รูปที่ ${idx + 1}`}
              className={`relative w-20 h-16 rounded-lg overflow-hidden border-2 ${idx === i ? "border-zinc-900" : "border-transparent"}`}>
              <Image src={p} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
