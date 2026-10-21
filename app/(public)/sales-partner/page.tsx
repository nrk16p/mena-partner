import type { Metadata } from "next"
import clientPromise from "@/lib/mongo"
import { getCatalogConfig } from "@/lib/catalog-config"
import { siteUrl } from "@/lib/public-seo"
import { COMMISSION_TIERS } from "@/lib/commission"
import { BrokerForm } from "@/components/public/broker-form"
import { CommissionCalc } from "@/components/public/commission-calc"
import { ThaiText, telHref } from "@/components/public/thai-text"

export const revalidate = 300

export const metadata: Metadata = {
  title: "สมัครเป็นนายหน้าขายรถร่วม รับค่าคอมสูงสุดคันละ 5,000 บาท | มีนาทรานสปอร์ต",
  description: "แนะนำคนขับมาซื้อรถร่วมกับมีนา รับค่าคอมขั้นบันไดคันละ 2,000–5,000 บาท ขายครบ 20 คันรับโบนัสเพิ่มอีก 5,000 บาท",
  alternates: { canonical: siteUrl("/sales-partner") },
}

/** ตามใบกระดาษข้อ 5.5 — ยอดสะสม 20 คันขึ้นไป รับเพิ่ม 5,000 (ช่วงเวลานับยอดบริษัทเป็นคนกำหนด) */
const TOP_SELLER_AT = 20
const TOP_SELLER_BONUS = 5000
const FIRST_PAYOUT = 1000

const fmt = (v: number) => v.toLocaleString("th-TH")

export default async function SalesPartnerPage() {
  const cfg = await getCatalogConfig((await clientPromise).db(process.env.MONGO_DB ?? "mena_partner"))

  // แถวตารางขั้นบันได: คันที่ 1–5, 6–10, 11–15, 16 ขึ้นไป
  const tiers = COMMISSION_TIERS.map((t, i) => {
    const from = i === 0 ? 1 : (COMMISSION_TIERS[i - 1].upTo ?? 0) + 1
    return { range: t.upTo ? `คันที่ ${from}–${t.upTo}` : `คันที่ ${from} ขึ้นไป`, rate: t.rate }
  })

  return (
    <>
      <section className="bg-[var(--mena-green-deep)] text-white">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20 grid gap-10 lg:grid-cols-[1.3fr_1fr] items-center">
          <div>
            <p className="text-sm text-white/70">นายหน้า / เซลล์ขายรถร่วม</p>
            <h1 className="mt-2 text-3xl sm:text-5xl font-medium leading-tight">
              {/* แยกวลีไม่ให้ตัดกลางคำ (เดิมมือถือขึ้น "รับค่า / คอมทุกคัน") */}
              <span className="whitespace-nowrap">แนะนำคนขับมาซื้อรถ</span>{" "}
              <span className="whitespace-nowrap">รับค่าคอมทุกคัน</span>
            </h1>
            <p className="mt-5 max-w-xl leading-[1.9] text-white/85 text-balance">
              <ThaiText>
                รู้จักคนขับที่อยากมีรถเป็นของตัวเอง พามาคุยกับฝ่ายขายได้เลย ปิดได้คันละ 2,000 ถึง 5,000 บาท
                ยิ่งขายมากอัตรายิ่งขึ้น และนับยอดสะสมไปเรื่อย ๆ ไม่รีเซ็ตทุกเดือน
              </ThaiText>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#สมัคร" className="rounded-full bg-white text-[var(--mena-green-deep)] px-6 py-3 font-medium hover:bg-white/90 transition-colors">
                กรอกใบสมัคร
              </a>
              {cfg.contactPhone && (
                <a href={telHref(cfg.contactPhone)} className="rounded-full border border-white/60 px-6 py-3 font-medium hover:bg-white/10 transition-colors">
                  ถามฝ่ายขาย {cfg.contactPhone}
                </a>
              )}
            </div>
            {/* ความน่าเชื่อถือ — ตัวเลขชุดเดียวกับหน้า /trucks (ฝ่ายขายให้มา 2026-09-23) */}
            <p className="mt-6 text-sm text-white/75">
              บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน) <span className="whitespace-nowrap">ดูแลรถมิกเซอร์กว่า 472 คัน</span> <span className="whitespace-nowrap">มากว่า 10 ปี</span>
            </p>
          </div>
          <CommissionCalc topSellerAt={TOP_SELLER_AT} topSellerBonus={TOP_SELLER_BONUS} />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-medium">ค่าคอมแบบขั้นบันได</h2>
          <p className="mt-2 leading-[1.9] text-[var(--mena-ink)]/70 text-balance">
            <ThaiText>แต่ละคันได้อัตราตามลำดับของคันนั้น คันที่จ่ายไปแล้วไม่ปรับย้อน เช่น ขายได้ 7 คัน 5 คันแรกได้คันละ 2,000 อีก 2 คันได้คันละ 3,500 รวม 17,000 บาท</ThaiText>
          </p>
          <table className="mt-6 w-full text-left bg-white rounded-2xl overflow-hidden border border-[var(--mena-line)]">
            <thead className="text-sm text-[var(--mena-ink)]/60 bg-[var(--mena-paper)]">
              <tr><th className="px-5 py-3 font-medium">ลำดับคันที่ขายได้</th><th className="px-5 py-3 font-medium text-right">ต่อคัน</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--mena-line)]">
              {tiers.map((t) => (
                <tr key={t.range}>
                  <td className="px-5 py-3.5">{t.range}</td>
                  <td className="px-5 py-3.5 text-right font-medium tabular-nums">฿{fmt(t.rate)}</td>
                </tr>
              ))}
              <tr className="bg-[var(--mena-green)]/5">
                <td className="px-5 py-3.5">
                  ขายครบ {TOP_SELLER_AT} คัน
                  <span className="block text-sm text-[var(--mena-ink)]/65">โบนัส Top Seller</span>
                </td>
                <td className="px-5 py-3.5 text-right font-medium tabular-nums text-[var(--mena-green)]">+฿{fmt(TOP_SELLER_BONUS)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[var(--mena-ink)]/65">โบนัส Top Seller นับยอดภายในโครงการหรือช่วงเวลาที่บริษัทกำหนด</p>
        </div>

        <div>
          <h2 className="text-2xl font-medium">ได้เงินเมื่อไหร่</h2>
          <p className="mt-2 leading-[1.9] text-[var(--mena-ink)]/70 text-balance">
            <ThaiText>จ่ายเป็นสองงวด นับจากวันที่คนขับที่เราแนะนำเริ่มวิ่งงาน</ThaiText>
          </p>
          <ol className="mt-6 space-y-4">
            <li className="flex gap-4 bg-white rounded-2xl border border-[var(--mena-line)] p-5">
              <span className="shrink-0 grid place-items-center h-10 w-10 rounded-full bg-[var(--mena-green)] text-white font-medium">1</span>
              <div>
                <p className="font-medium">วิ่งงานครบ 1 เดือน รับ ฿{fmt(FIRST_PAYOUT)}</p>
                <p className="mt-1 text-sm text-[var(--mena-ink)]/65">งวดแรกเท่ากันทุกคัน ไม่ว่าคันนั้นจะอยู่ขั้นไหน</p>
              </div>
            </li>
            <li className="flex gap-4 bg-white rounded-2xl border border-[var(--mena-line)] p-5">
              <span className="shrink-0 grid place-items-center h-10 w-10 rounded-full bg-[var(--mena-green)] text-white font-medium">2</span>
              <div>
                <p className="font-medium">วิ่งงานครบ 3 เดือน รับส่วนที่เหลือ</p>
                <p className="mt-1 text-sm text-[var(--mena-ink)]/65">เช่น คันที่อยู่ขั้น 3,500 บาท งวดนี้ได้อีก 2,500 บาท</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="สมัคร" className="max-w-3xl mx-auto px-4 pb-6 scroll-mt-24">
        <h2 className="text-2xl font-medium">ใบสมัครนายหน้า / เซลล์ขายรถร่วม</h2>
        <p className="mt-2 leading-[1.9] text-[var(--mena-ink)]/70">
          <ThaiText>กรอกประมาณ 3 นาที ช่องที่มี * ต้องกรอก ข้อมูลบัตรกับบัญชีใช้แค่ตอนจ่ายค่าคอม</ThaiText>
        </p>
        {/* บอกก่อนกรอกว่าส่งแล้วจะเกิดอะไร — คนลังเลน้อยลงตอนต้องใส่เลขบัตร/บัญชี */}
        <ol className="mt-5 mb-8 grid gap-3 sm:grid-cols-3 text-sm">
          {[
            ["ส่งใบสมัคร", "ใช้เวลาประมาณ 3 นาที"],
            ["ฝ่ายขายโทรกลับ", "ภายใน 2–3 วันทำการ"],
            ["พาคนขับมาคุย", "ปิดการขายแล้วรับค่าคอม"],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3">
              <span className="shrink-0 grid place-items-center h-7 w-7 rounded-full border border-[var(--mena-green)] text-[var(--mena-green)] text-sm font-medium tabular-nums">{i + 1}</span>
              <span><span className="block font-medium">{t}</span><span className="text-[var(--mena-ink)]/65">{d}</span></span>
            </li>
          ))}
        </ol>
        <BrokerForm phone={cfg.contactPhone} />
      </section>
    </>
  )
}
