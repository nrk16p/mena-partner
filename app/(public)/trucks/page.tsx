import type { Metadata } from "next"
import Image from "next/image"
import clientPromise from "@/lib/mongo"
import { getCatalogConfig } from "@/lib/catalog-config"
import { loadPublicTrucks } from "@/lib/public-trucks"
import { siteUrl, fmtBaht } from "@/lib/public-seo"
import { TruckBrowser } from "@/components/public/truck-browser"

export const revalidate = 600

export const metadata: Metadata = {
  title: "รถผสมปูน (มิกเซอร์) มือสอง พร้อมงานวิ่ง | มีนา ทรานสปอร์ต",
  description: "รถผสมปูนมือสองจากกองรถบริษัท เจ้าของเดียว มีประวัติซ่อมบำรุงครบ ผ่อนกับบริษัทโดยตรง พร้อมงานวิ่งรองรับ",
  alternates: { canonical: siteUrl("/trucks") },
}

export default async function TrucksPage() {
  const db = (await clientPromise).db(process.env.MONGO_DB ?? "mena_partner")
  const [trucks, cfg] = await Promise.all([loadPublicTrucks(), getCatalogConfig(db)])
  const cheapest = trucks.reduce((m, t) => (t.display.monthlyPayment > 0 && (m === 0 || t.display.monthlyPayment < m) ? t.display.monthlyPayment : m), 0)

  return (
    <>
      {/* รูปกองรถจากเว็บบริษัท — ภาพที่ลูกค้ากลุ่มนี้รู้จักดีที่สุดคือรถของเราบนถนนจริง */}
      <section className="relative">
        <div className="absolute inset-0">
          <Image src="/brand/fleet-hero.webp" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(2,58,30,0.94)_0%,rgba(2,58,30,0.82)_45%,rgba(2,58,30,0.35)_100%)]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-12 sm:pt-20 sm:pb-16 text-white">
          <h1 className="text-3xl sm:text-5xl font-medium leading-tight max-w-2xl">
            รถผสมปูนมือสอง จากกองรถที่เราดูแลเอง
          </h1>
          <p className="mt-4 max-w-xl text-white/85 leading-relaxed">
            {cfg.tagline || "เจ้าของเดียวตั้งแต่ออกจากศูนย์ ประวัติซ่อมบำรุงครบทุกครั้ง ผ่อนกับบริษัทโดยตรง และมีงานวิ่งรองรับตั้งแต่วันแรก"}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#รถพร้อมขาย" className="rounded-full bg-white text-[var(--mena-green-deep)] px-6 py-3 font-medium hover:bg-white/90 transition-colors">
              ดูรถพร้อมขาย {trucks.length} คัน
            </a>
            {cfg.contactPhone && (
              <a href={`tel:${cfg.contactPhone}`} className="rounded-full border border-white/60 px-6 py-3 font-medium hover:bg-white/10 transition-colors">
                โทรหาฝ่ายขาย {cfg.contactPhone}
              </a>
            )}
          </div>

          <dl className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/20 rounded-2xl overflow-hidden max-w-2xl">
            {[
              ["พร้อมขายตอนนี้", `${trucks.length} คัน`],
              ["ผ่อนเริ่มต้น", cheapest ? `฿${fmtBaht(cheapest)}/เดือน` : "สอบถามฝ่ายขาย"],
              ["ผู้ขาย", "กองรถบริษัทเอง"],
            ].map(([k, v], i) => (
              // จอมือถือเรียง 2 คอลัมน์ ช่องสุดท้ายกินเต็มแถว ไม่ให้เหลือช่องโหว่เห็นรูปทะลุ
              <div key={k} className={`bg-[var(--mena-green-deep)]/85 px-5 py-4 ${i === 2 ? "col-span-2 sm:col-span-1" : ""}`}>
                <dt className="text-xs text-white/70">{k}</dt>
                <dd className="mt-1 font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="รถพร้อมขาย" className="max-w-6xl mx-auto px-4 py-12 sm:py-16 scroll-mt-20">
        <h2 className="text-2xl font-medium">รถพร้อมขาย</h2>
        <p className="text-[var(--mena-ink)]/60 mt-1">ราคารวมโปรโมชั่นที่ติดมากับรถ · ดูรายละเอียดรายคันได้เลย</p>
        <div className="mt-8">
          <TruckBrowser trucks={trucks} />
        </div>
      </section>

      {cfg.sellingPoints.length > 0 && (
        <section className="bg-[var(--mena-paper)]">
          <div className="max-w-6xl mx-auto px-4 py-14">
            <h2 className="text-2xl font-medium text-[var(--mena-green)]">ทำไมซื้อรถจากกองรถมีนา</h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-3">
              {cfg.sellingPoints.slice(0, 3).map((p) => (
                <li key={p} className="bg-white rounded-2xl p-6 border border-[var(--mena-line)]">
                  <p className="leading-relaxed">{p}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
