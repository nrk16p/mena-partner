import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import clientPromise from "@/lib/mongo"
import { getCatalogConfig } from "@/lib/catalog-config"
import { loadPublicTruckBySlug, loadPublicTrucks } from "@/lib/public-trucks"
import { siteUrl, truckTitle, truckDescription, truckJsonLd, fmtBaht } from "@/lib/public-seo"
import { TruckGallery } from "@/components/public/truck-gallery"
import { TruckSpecTable } from "@/components/public/truck-spec-table"
import { TruckCard } from "@/components/public/truck-card"
import { LeadForm } from "@/components/public/lead-form"

export const revalidate = 600

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const truck = await loadPublicTruckBySlug(slug)
  if (!truck) return { title: "ไม่พบรถคันนี้" }
  const url = siteUrl(`/trucks/${truck.slug}`)
  return {
    title: truckTitle(truck),
    description: truckDescription(truck),
    alternates: { canonical: url },
    // รถที่ขายแล้ว: เก็บหน้าไว้ (สะสมลิงก์) แต่ไม่ให้ Google เก็บ index
    robots: truck.isSold ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website", url, title: truckTitle(truck), description: truckDescription(truck),
      images: [{ url: siteUrl(`/og/truck/${truck.slug}`), width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: truckTitle(truck), description: truckDescription(truck) },
  }
}

export default async function TruckDetailPage({ params }: Params) {
  const { slug } = await params
  const truck = await loadPublicTruckBySlug(slug)
  if (!truck) notFound()

  const db = (await clientPromise).db(process.env.MONGO_DB ?? "mena_partner")
  const [cfg, all] = await Promise.all([getCatalogConfig(db), loadPublicTrucks()])
  const related = all.filter((t) => t.slug !== truck.slug).slice(0, 3)
  const title = [truck.brand, truck.model].filter(Boolean).join(" ") || "รถผสมปูนมือสอง"
  const y = truck.registrationYear
  const heading = `${title}${y ? ` ปี ${y + 543}` : ""}`

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(truckJsonLd(truck)) }} />

      <nav className="text-sm text-zinc-500 mb-5">
        <Link href="/trucks" className="hover:underline">รถมือสอง</Link>
        <span className="mx-2">›</span>
        <span>{truck.vehicleType || "รถผสมปูน"}</span>
        <span className="mx-2">›</span>
        <span className="text-zinc-800">{heading}</span>
      </nav>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div>
          <TruckGallery photos={[truck.photos.front, truck.photos.left, truck.photos.right, truck.photos.back, truck.photos.cabin]} alt={`${heading} มือสอง`} />
        </div>

        <div>
          {truck.isSold && (
            <p className="mb-3 inline-block rounded-full bg-zinc-900 text-white text-xs font-semibold px-3 py-1">ขายแล้ว</p>
          )}
          <h1 className="text-2xl font-bold">{heading}</h1>
          <p className="text-3xl font-bold mt-3">฿{fmtBaht(truck.display.price)}</p>
          {truck.display.monthlyPayment > 0 && (
            <p className="text-emerald-700 font-semibold mt-1">
              ผ่อน ฿{fmtBaht(truck.display.monthlyPayment)}/เดือน
              {truck.financeInstallments > 0 && ` × ${truck.financeInstallments} งวด`}
              {truck.display.downPayment > 0 && ` · ดาวน์ ฿${fmtBaht(truck.display.downPayment)}`}
            </p>
          )}

          <div className="flex gap-2 mt-5">
            {cfg.contactPhone && (
              <a href={`tel:${cfg.contactPhone}`} className="flex-1 text-center rounded-xl bg-zinc-900 text-white font-semibold py-3">โทรหาฝ่ายขาย</a>
            )}
            {cfg.contactLine && (
              <a href={`https://line.me/R/ti/p/${encodeURIComponent(cfg.contactLine)}`} className="flex-1 text-center rounded-xl border border-zinc-300 font-semibold py-3">LINE</a>
            )}
          </div>

          {truck.promos.length > 0 && (
            <div className="mt-6 space-y-2.5">
              {truck.promos.map((p) => (
                <div key={p.badge} className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm">
                  <p className="font-semibold">
                    <span className="mr-2 rounded-full bg-amber-500 text-white text-[11px] px-2 py-0.5 align-middle">{p.badge}</span>
                    {p.title}
                  </p>
                  <div className="mt-1 text-zinc-700">
                    {p.lines.map((l, i) => (
                      <p key={i}>
                        {l.map((s, j) => typeof s === "string" ? s
                          : "b" in s ? <b key={j} className="text-zinc-900">{s.b}</b>
                          : <span key={j} className="text-base font-bold text-amber-700">{s.big}</span>)}
                      </p>
                    ))}
                  </div>
                  {p.note && <p className="mt-1.5 text-xs text-zinc-500">{p.note}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-zinc-200 p-5">
            <p className="text-sm font-semibold mb-3">ข้อมูลรถ</p>
            <TruckSpecTable truck={truck} />
          </div>

          {!truck.isSold && (
            <div className="mt-6">
              <LeadForm slug={truck.slug} />
            </div>
          )}
        </div>
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg font-bold">ทำไมต้องซื้อรถจากกองรถบริษัท</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          {cfg.sellingPoints.map((p) => <li key={p} className="flex gap-2"><span className="text-emerald-600">✓</span>{p}</li>)}
        </ul>
        {cfg.terms.length > 0 && (
          <div className="mt-6 text-xs text-zinc-500 space-y-1">
            {cfg.terms.map((t) => <p key={t}>{t}</p>)}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-zinc-200 p-5 max-w-3xl">
        <p className="text-sm text-zinc-500">ผู้ขาย</p>
        <p className="font-bold text-lg">บริษัท มีนา ทรานสปอร์ต จำกัด</p>
        <p className="text-sm text-zinc-600 mt-1">{cfg.contactName}{cfg.contactPhone ? ` · ${cfg.contactPhone}` : ""}</p>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold mb-4">รถคันอื่นที่น่าสนใจ</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((t) => <TruckCard key={t.slug} truck={t} />)}
          </div>
        </section>
      )}
    </div>
  )
}
