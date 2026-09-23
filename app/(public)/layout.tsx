import Image from "next/image"
import Link from "next/link"
import { Prompt } from "next/font/google"
import clientPromise from "@/lib/mongo"
import { getCatalogConfig } from "@/lib/catalog-config"
import { ContactBar } from "@/components/public/contact-bar"
import { ThaiText, telHref } from "@/components/public/thai-text"

/**
 * หน้าเว็บสาธารณะ (ขายรถ /trucks) — ไม่มี sidebar, ไม่ต้อง login, light mode คงที่
 * (root layout เปิด dark ตาม localStorage ของพนักงาน — หน้าขายต้องขาวเสมอ จึง override สีเอง)
 *
 * โทนแบรนด์ถอดจากเว็บทางการ menatransport.co.th: เขียว #046132, ฟอนต์ Prompt, ปุ่มทรงแคปซูล
 * โลโก้/รูปรถเก็บไว้ใน public/brand (ไม่ลิงก์ข้ามเว็บ — ภาพจะได้ไม่หายเวลาเว็บบริษัทเปลี่ยน)
 * ห้ามใช้ utility สี zinc / emerald ในโซนนี้ — globals.css แม็พไว้เป็นชุดสีระบบหลังบ้าน (เข้ม) ให้ใช้ตัวแปร --mena- แทน
 */

const prompt = Prompt({ subsets: ["latin", "thai"], weight: ["300", "400", "500", "600"], display: "swap" })

const BRAND = {
  "--mena-green": "#046132",
  "--mena-green-deep": "#023A1E",
  "--mena-green-soft": "#338B5F",
  "--mena-red": "#EC1C24",
  "--mena-paper": "#F3F4F5",
  "--mena-ink": "#212529",
  "--mena-line": "#DFE3E6",
} as React.CSSProperties

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const cfg = await getCatalogConfig((await clientPromise).db(process.env.MONGO_DB ?? "mena_partner"))

  return (
    <div
      style={{ ...BRAND, colorScheme: "light" }}
      className={`${prompt.className} min-h-screen flex flex-col bg-[var(--mena-paper)] text-[var(--mena-ink)]`}
    >
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[var(--mena-line)]">
        <div className="max-w-6xl mx-auto px-4 h-[72px] flex items-center gap-6">
          <Link href="/trucks" className="flex items-center gap-3 shrink-0">
            <Image src="/brand/mena-logo.svg" alt="มีนาทรานสปอร์ต" width={104} height={71} className="h-11 w-auto" priority />
            <span className="hidden sm:block leading-tight">
              <span className="block text-[15px] font-medium text-[var(--mena-green)]">รถบรรทุกมือสอง</span>
              <span className="block text-xs text-[var(--mena-ink)]/60">บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:gap-4 text-sm">
            <Link href="/trucks" className="px-2 py-1 hover:text-[var(--mena-green)]">รถพร้อมขาย</Link>
            <a href="https://www.menatransport.co.th" className="hidden sm:block px-2 py-1 hover:text-[var(--mena-green)]">เว็บไซต์บริษัท</a>
            {cfg.contactPhone && (
              <a
                href={telHref(cfg.contactPhone)}
                className="rounded-full bg-[var(--mena-green)] text-white px-4 sm:px-5 py-2.5 font-medium hover:bg-[var(--mena-green-soft)] transition-colors"
              >
                โทร {cfg.contactPhone}
              </a>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <ContactBar phone={cfg.contactPhone} line={cfg.contactLine} />

      <footer className="mt-20 bg-[var(--mena-green-deep)] text-white/80">
        <div className="max-w-6xl mx-auto px-4 py-14 grid gap-10 sm:gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <span className="inline-flex bg-white rounded-xl px-3 py-2">
              <Image src="/brand/mena-logo.svg" alt="มีนาทรานสปอร์ต" width={104} height={71} className="h-10 w-auto" />
            </span>
            <p className="mt-5 font-medium text-white">บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)</p>
            <p className="mt-2 max-w-xs text-sm leading-[1.9] text-balance">
              <ThaiText>รถบรรทุกมือสองจากบริษัท เจ้าของเดียว ประวัติซ่อมบำรุงครบทุกระยะ ผ่อนตรงกับบริษัท ไม่ผ่านไฟแนนซ์</ThaiText>
            </p>
          </div>

          <div className="text-sm">
            <p className="font-medium text-white">ติดต่อฝ่ายขาย</p>
            <ul className="mt-3 space-y-2.5">
              {cfg.contactName && <li>{cfg.contactName}</li>}
              {cfg.contactPhone && <li><a href={telHref(cfg.contactPhone)} className="hover:text-white">โทร {cfg.contactPhone}</a></li>}
              {cfg.contactLine && (
                <li>
                  <a href={`https://line.me/R/ti/p/${encodeURIComponent(cfg.contactLine)}`} className="hover:text-white">
                    LINE {cfg.contactLine}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="text-sm">
            <p className="font-medium text-white">เกี่ยวกับบริษัท</p>
            <ul className="mt-3 space-y-2.5">
              <li><a href="https://www.menatransport.co.th" className="hover:text-white">menatransport.co.th</a></li>
              <li><Link href="/trucks" className="hover:text-white">รถพร้อมขายทั้งหมด</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/15">
          {/* เว้นที่ท้ายเว็บให้แถบปุ่มบนมือถือ ไม่ให้ทับบรรทัดลิขสิทธิ์ */}
          <p className="max-w-6xl mx-auto px-4 py-5 pb-24 lg:pb-5 text-xs">
            © {new Date().getFullYear()} บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน)
          </p>
        </div>
      </footer>
    </div>
  )
}
