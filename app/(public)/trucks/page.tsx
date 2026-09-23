import type { Metadata } from "next"
import Image from "next/image"
import clientPromise from "@/lib/mongo"
import { getCatalogConfig } from "@/lib/catalog-config"
import { loadPublicTrucks } from "@/lib/public-trucks"
import { siteUrl, fmtBaht } from "@/lib/public-seo"
import { TruckBrowser } from "@/components/public/truck-browser"
import { LeadForm } from "@/components/public/lead-form"
import { ThaiText } from "@/components/public/thai-text"

export const revalidate = 600

export const metadata: Metadata = {
  title: "รถมิกเซอร์มือสอง พร้อมงานวิ่ง ผ่อนตรงกับบริษัท | มีนา ทรานสปอร์ต",
  description: "รถมิกเซอร์มือสองที่บริษัทใช้งานเอง เจ้าของเดียว ประวัติซ่อมบำรุงครบทุกระยะ ผ่อนตรงกับบริษัท ไม่ผ่านไฟแนนซ์ พร้อมงานวิ่งรองรับตั้งแต่วันแรก",
  alternates: { canonical: siteUrl("/trucks") },
}

export default async function TrucksPage() {
  const db = (await clientPromise).db(process.env.MONGO_DB ?? "mena_partner")
  const [trucks, cfg] = await Promise.all([loadPublicTrucks(), getCatalogConfig(db)])
  const cheapest = trucks.reduce((m, t) => (t.display.monthlyPayment > 0 && (m === 0 || t.display.monthlyPayment < m) ? t.display.monthlyPayment : m), 0)

  return (
    <>
      {/* รูปขบวนรถจากเว็บบริษัท — ภาพที่ลูกค้ากลุ่มนี้รู้จักดีที่สุดคือรถของเราบนถนนจริง */}
      <section className="relative">
        <div className="absolute inset-0">
          <Image src="/brand/fleet-hero.webp" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(2,58,30,0.94)_0%,rgba(2,58,30,0.82)_45%,rgba(2,58,30,0.35)_100%)]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-12 sm:pt-20 sm:pb-16 text-white">
          <h1 className="text-3xl sm:text-5xl font-medium leading-tight max-w-2xl">
            รถมิกเซอร์มือสอง ที่เราใช้งานเองทุกวัน
          </h1>
          <p className="mt-4 max-w-xl text-white/85 leading-relaxed">
            <ThaiText>{cfg.tagline || "เจ้าของเดียวตั้งแต่ออกจากศูนย์ ประวัติซ่อมบำรุงครบทุกระยะ ผ่อนตรงกับบริษัท ไม่ผ่านไฟแนนซ์ และมีงานวิ่งรองรับตั้งแต่วันแรก"}</ThaiText>
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

          <dl className="mt-10 grid grid-cols-2 gap-px bg-white/20 rounded-2xl overflow-hidden max-w-md">
            {[
              ["พร้อมขายตอนนี้", `${trucks.length} คัน`],
              ["ผ่อนเริ่มต้น", cheapest ? `฿${fmtBaht(cheapest)}/เดือน` : "สอบถามฝ่ายขาย"],
            ].map(([k, v]) => (
              <div key={k} className="bg-[var(--mena-green-deep)]/85 px-5 py-4">
                <dt className="text-xs text-white/70">{k}</dt>
                <dd className="mt-1 font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="รถพร้อมขาย" className="max-w-6xl mx-auto px-4 py-12 sm:py-16 scroll-mt-20">
        <h2 className="text-2xl font-medium">รถพร้อมส่งมอบ</h2>
        <p className="text-[var(--mena-ink)]/60 mt-1">ทุกคันมีโปรโมชั่นติดรถ ดูราคาและแผนผ่อนได้ทุกคัน</p>
        <div className="mt-8">
          <TruckBrowser trucks={trucks} />
        </div>
      </section>

      {/* ความน่าเชื่อถือของผู้ขาย — ข้อความจากเว็บบริษัท (ฝ่ายขายให้มา 2026-09-23) */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 py-14 grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-medium text-[var(--mena-green)]">ขนส่งคอนกรีตผสมเสร็จ</h2>
            <p className="mt-5 leading-[1.9] text-balance">
              <ThaiText>
                เราเชี่ยวชาญในการขนส่งคอนกรีตผสมเสร็จ โดยได้รับความไว้วางใจจากบริษัทปูนซีเมนต์และบริษัทคอนกรีตชั้นนำของประเทศ ให้บริหารจัดการรถมิกเซอร์กว่า 472 คัน ด้วยประสบการณ์กว่า 10 ปี
              </ThaiText>
            </p>
            <dl className="mt-8 flex flex-wrap gap-10">
              <div>
                <dt className="text-sm text-[var(--mena-ink)]/55">รถมิกเซอร์ที่ดูแล</dt>
                <dd className="text-3xl font-semibold text-[var(--mena-green)] tabular-nums">472 คัน</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--mena-ink)]/55">ประสบการณ์</dt>
                <dd className="text-3xl font-semibold text-[var(--mena-green)] tabular-nums">กว่า 10 ปี</dd>
              </div>
            </dl>
          </div>
          <div className="relative aspect-[7/5] rounded-2xl overflow-hidden">
            <Image src="/brand/mixer-service.jpg" alt="รถมิกเซอร์ของมีนา ทรานสปอร์ต" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>

      {cfg.sellingPoints.length > 0 && (
        <section>
          <div className="max-w-6xl mx-auto px-4 py-14">
            <h2 className="text-2xl font-medium text-[var(--mena-green)]">ซื้อรถกับมีนา ได้มากกว่ารถหนึ่งคัน</h2>
            {/* text-balance = เฉลี่ยความยาวแต่ละบรรทัด ไม่ให้เหลือคำโดดท้ายย่อหน้า (ข้อความมาจาก catalog_config แก้ได้ที่ /catalog) */}
            <ul className="mt-8 grid gap-6 sm:grid-cols-3">
              {cfg.sellingPoints.slice(0, 3).map((p) => (
                <li key={p} className="bg-white rounded-2xl px-7 py-6 border border-[var(--mena-line)]">
                  <p className="leading-[1.9] text-balance"><ThaiText>{p}</ThaiText></p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <section id="ติดต่อ" className="max-w-6xl mx-auto px-4 py-14 scroll-mt-24 grid gap-10 lg:grid-cols-[1fr_1.1fr] items-start">
        <div>
          <h2 className="text-2xl font-medium">สนใจคันไหน ให้เราโทรกลับ</h2>
          <p className="mt-3 leading-[1.9] text-balance text-[var(--mena-ink)]/70">
            <ThaiText>ฝากชื่อกับเบอร์ไว้ ฝ่ายขายจะโทรกลับพร้อมราคา เงื่อนไขการผ่อน และนัดเวลาเข้ามาดูรถ</ThaiText>
          </p>
        </div>
        <LeadForm slug="" />
      </section>
    </>
  )
}
