import type { ReactNode, CSSProperties } from "react"
import {
  Crown, Check, Phone, MessageCircle, Truck, Tag, Calendar, Gauge,
  Wrench, ShieldCheck, Gift, Sparkles, Star,
} from "lucide-react"

/**
 * TruckCatalogPoster — โปสเตอร์แคตตาล็อกรถมิกเซอร์มือสอง MENA TRANSPORT (แนวตั้ง 2:3)
 * ธีมเขียวเข้ม-ทอง · Tailwind utility ล้วน · โทเคนสีเป็น CSS variable (เปลี่ยนแบรนด์ได้ผ่าน prop `theme`)
 *
 * โหมดแสดงผล
 *   fluid (default) — กว้างตามจอ สูงสุด 1024px, จอ <768px กริดยุบเป็น 1-2 คอลัมน์
 *   fixed           — กว้างคงที่ 1024px (สูง ≥1536) สำหรับพิมพ์/export เป็นภาพ ย่อขยายด้วย `scale`
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TruckSpec { label: string; value: string }
export interface GalleryItem { src: string; caption: string }
export interface Promotion { badge: string; title: string; body: ReactNode; icon?: ReactNode }

export interface TruckCatalog {
  brand: string
  modelCode: string
  plate: string
  specs: TruckSpec[]
  status: string
  price: number
  monthlyPayment: number
  heroImage: string
  gallery: GalleryItem[]
  quote: string
  highlights: string[]
  promotions: Promotion[]
  contactPhone?: string
  lineId?: string
}

/** โทเคนสีแบรนด์ — override ได้บางตัว */
export interface PosterTheme {
  greenDark: string
  green: string
  greenLight: string
  gold: string
  goldLight: string
  cream: string
  white: string
}

export interface TruckCatalogPosterProps extends Partial<TruckCatalog> {
  mode?: "fluid" | "fixed"
  scale?: number
  theme?: Partial<PosterTheme>
}

// ─── Design tokens ────────────────────────────────────────────────────────────

export const DEFAULT_THEME: PosterTheme = {
  greenDark:  "#0B3B2E",
  green:      "#14532D",
  greenLight: "#2F6B4F",
  gold:       "#C9A227",
  goldLight:  "#E6CE86",
  cream:      "#F6F1E4",
  white:      "#FFFFFF",
}

/** ค่าเริ่มต้นบน :root (ใส่ครั้งเดียว) — instance ใด ๆ override ผ่าน style บน wrapper ได้ */
const ROOT_VARS = `:root{--mt-green-dark:${DEFAULT_THEME.greenDark};--mt-green:${DEFAULT_THEME.green};--mt-green-light:${DEFAULT_THEME.greenLight};--mt-gold:${DEFAULT_THEME.gold};--mt-gold-light:${DEFAULT_THEME.goldLight};--mt-cream:${DEFAULT_THEME.cream};--mt-white:${DEFAULT_THEME.white};--mt-gold-grad:linear-gradient(135deg,#8A6A00 0%,#C9A227 35%,#F5E6A8 55%,#C9A227 75%,#8A6A00 100%);--mt-green-grad:linear-gradient(160deg,#0B3B2E 0%,#14532D 55%,#2F6B4F 100%)}`

// class ย่อที่ใช้ซ้ำ — Tailwind arbitrary values อ้าง CSS variable
const T = {
  font:       "font-[var(--font-noto-thai),Prompt,Kanit,'Noto_Sans_Thai',sans-serif]",
  goldText:   "bg-[image:var(--mt-gold-grad)] bg-clip-text text-transparent",
  goldBg:     "bg-[image:var(--mt-gold-grad)]",
  greenGrad:  "bg-[image:var(--mt-green-grad)]",
  shadow:     "shadow-[0_18px_40px_-16px_rgba(11,59,46,0.45)]",
  shadowSoft: "shadow-[0_10px_24px_-12px_rgba(11,59,46,0.35)]",
}

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 })

// ─── Mock data (NISSAN ME135) ─────────────────────────────────────────────────

const PLACEHOLDER = (w: number, h: number, text: string) =>
  `https://placehold.co/${w}x${h}/0B3B2E/E6CE86?text=${encodeURIComponent(text)}`

export const MOCK_TRUCK: TruckCatalog = {
  brand: "NISSAN",
  modelCode: "ME135",
  plate: "สบ.70-6298",
  specs: [
    { label: "รุ่น",          value: "CWM454HMRA" },
    { label: "ประเภทรถ",      value: "รถผสมปูน 10 ล้อ" },
    { label: "ปีจดทะเบียน",   value: "2558" },
  ],
  status: "พร้อมขาย",
  price: 1_698_591,
  monthlyPayment: 16_652,
  heroImage: PLACEHOLDER(1024, 620, "NISSAN ME135"),
  gallery: [
    { src: PLACEHOLDER(400, 300, "Front"), caption: "ด้านหน้า" },
    { src: PLACEHOLDER(400, 300, "Left"), caption: "ด้านซ้าย" },
    { src: PLACEHOLDER(400, 300, "Right"),  caption: "ด้านขวา" },
    { src: PLACEHOLDER(400, 300, "Back"), caption: "ด้านหลัง" },
  ],
  quote: "ซื้อรถกับเรา ไม่ใช่แค่ได้รถ แต่ได้งานวิ่งตั้งแต่วันแรก",
  highlights: [
    "เจ้าของเดียว ประวัติซ่อมบำรุงครบทุกครั้ง",
    "มีงานวิ่งรองรับกับแพล้นท์ปูนในเครือทันที",
    "ผ่อนกับบริษัทโดยตรง ไม่ต้องกู้ไฟแนนซ์",
  ],
  promotions: [
    {
      badge: "ต่อที่ 1", title: "ฟรีค่างวด 9 ฟรี 1",
      body: <>ผ่อนครบ <b>9 งวด</b> รับ<span className="font-bold text-[var(--mt-gold)]">ฟรี 1 งวด</span> ตลอดอายุสัญญา</>,
      icon: <Gift className="w-10 h-10" />,
    },
    {
      badge: "ต่อที่ 2", title: "ฟรีค่าซ่อมบำรุง",
      body: <>วงเงินซ่อม <b className="text-[var(--mt-green)]">120,000 บาท</b> อะไหล่ + ค่าแรง ที่ศูนย์ซ่อมของบริษัท</>,
      icon: <Wrench className="w-10 h-10" />,
    },
    {
      badge: "ต่อที่ 3", title: "ฟรี PM ทุกปี",
      body: <>บำรุงรักษาเชิงป้องกันมูลค่า <b className="text-[var(--mt-green)]">10,070 บาท/ปี</b> ตลอดสัญญา</>,
      icon: <ShieldCheck className="w-10 h-10" />,
    },
  ],
  contactPhone: "",
  lineId: "",
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** 1. Header — แถบทแยง + ป้ายหัวเรื่อง + quote + จุดเด่น 3 ข้อ */
function Header({ quote, highlights }: { quote: string; highlights: string[] }) {
  return (
    <header className="relative overflow-hidden px-8 pt-10 pb-6">
      {/* แถบทแยงสีขาว/เงิน มุมซ้ายบน */}
      <div aria-hidden className="absolute -top-16 -left-24 w-[420px] h-[140px] rotate-[-18deg] bg-[linear-gradient(90deg,#ffffff_0%,#d9dde0_60%,transparent_100%)] opacity-90" />
      <div aria-hidden className="absolute -top-8 -left-28 w-[420px] h-[26px] rotate-[-18deg] bg-[var(--mt-gold-light)] opacity-80" />

      {/* ป้ายหัวเรื่อง */}
      <div className="relative mx-auto w-fit text-center">
        <Crown className="mx-auto w-8 h-8 text-[var(--mt-gold)] mb-1" strokeWidth={1.75} />
        <div className={`rounded-2xl border-2 border-[var(--mt-gold)] bg-[var(--mt-green-dark)] px-10 py-4 ${T.shadow}`}>
          <p className="text-[11px] md:text-xs tracking-[0.35em] font-semibold text-[var(--mt-gold-light)] uppercase">Used Mixer Truck</p>
          <h1 className={`mt-1 text-4xl md:text-6xl font-black italic leading-tight ${T.goldText}`}>เถ้าแก่น้อยมีนา</h1>
        </div>
        {/* ริบบิ้นล่าง */}
        <div className={`mx-auto -mt-3 w-fit px-6 py-1.5 rounded-full text-[11px] md:text-xs font-bold tracking-[0.2em] text-[#3F3000] ${T.goldBg} ${T.shadowSoft}`}>
          MENA TRANSPORT MIXER TRUCK CATALOG
        </div>
      </div>

      {/* quote ซ้าย · จุดเด่นขวา */}
      <div className="relative mt-8 grid gap-6 md:grid-cols-2 items-start">
        <blockquote className="text-lg md:text-xl italic text-[var(--mt-green-dark)] leading-relaxed">
          <span className="text-3xl text-[var(--mt-gold)] leading-none align-top">“</span>
          {quote}
          <span className="text-3xl text-[var(--mt-gold)] leading-none align-top">”</span>
        </blockquote>
        <div>
          <p className="text-xl md:text-2xl font-black text-[var(--mt-green-dark)]">รถดี พร้อมลุยงาน</p>
          <ul className="mt-2 space-y-2">
            {highlights.slice(0, 3).map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-sm md:text-base text-[var(--mt-green-dark)]">
                <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-[var(--mt-green)] text-white grid place-items-center">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  )
}

/** ไอคอนประจำ label ของ spec (ไม่ตรงชื่อ → Tag) */
function specIcon(label: string) {
  const cls = "w-4 h-4"
  if (label.includes("รุ่น"))   return <Truck className={cls} />
  if (label.includes("ประเภท")) return <Gauge className={cls} />
  if (label.includes("ปี"))     return <Calendar className={cls} />
  return <Tag className={cls} />
}

/** 2a. SpecCard — การ์ดขาวลอยทับมุมขวาของรูป hero */
function SpecCard({ brand, modelCode, plate, specs, status }: Pick<TruckCatalog, "brand" | "modelCode" | "plate" | "specs" | "status">) {
  return (
    <div className={`rounded-3xl bg-white p-5 md:p-6 w-full md:w-[360px] ${T.shadow}`}>
      <p className="text-3xl md:text-4xl font-black tracking-wide text-[var(--mt-green-dark)]">{brand}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--mt-green-light)]">
        {modelCode}<span className="mx-2 text-[var(--mt-gold)]">|</span>{plate}
      </p>
      <dl className="mt-4 divide-y divide-[var(--mt-cream)]">
        {specs.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <dt className="flex items-center gap-2 text-[var(--mt-green-light)]">{specIcon(s.label)}{s.label}</dt>
            <dd className="font-bold text-[var(--mt-green-dark)] text-right">{s.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 py-2 text-sm">
          <dt className="flex items-center gap-2 text-[var(--mt-green-light)]"><Star className="w-4 h-4" />สถานะ</dt>
          <dd>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mt-green)] text-white text-xs font-bold px-3 py-1">
              <Check className="w-3 h-3" strokeWidth={3} />{status}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  )
}

/** 2b. PriceBlock — ราคารถ + ผ่อนต่อเดือน พื้นเขียวไล่เฉด */
function PriceBlock({ price, monthlyPayment }: Pick<TruckCatalog, "price" | "monthlyPayment">) {
  return (
    <div className={`rounded-3xl ${T.greenGrad} text-white px-6 py-5 md:px-8 md:py-6 ${T.shadow} grid gap-4 md:grid-cols-2 items-end`}>
      <div>
        <p className="text-sm text-[var(--mt-gold-light)]">ราคารถ</p>
        <p className="leading-none">
          <span className="text-5xl md:text-6xl font-black tracking-tight">{baht(price)}</span>
          <span className="ml-2 text-base text-[var(--mt-gold-light)]">บาท</span>
        </p>
      </div>
      <div className="md:text-right">
        <p className="text-sm text-[var(--mt-gold-light)]">ผ่อนเพียงเดือนละ</p>
        <p className="leading-none">
          <span className={`text-4xl md:text-5xl font-black tracking-tight ${T.goldText}`}>{baht(monthlyPayment)}</span>
          <span className="ml-2 text-base text-[var(--mt-gold-light)]">บาท</span>
        </p>
      </div>
    </div>
  )
}

/** 2. Hero + Spec card ซ้อนกัน แล้วต่อด้วยบล็อกราคา */
function HeroSection({ truck }: { truck: TruckCatalog }) {
  return (
    <section className="px-8">
      <div className="relative">
        <div className="rounded-3xl overflow-hidden aspect-[16/10] bg-[var(--mt-green-dark)]">
          {/* รูปรถหลัก — ใช้ <img> ธรรมดาเพื่อให้ export เป็นภาพได้ตรง ๆ */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={truck.heroImage} alt={`${truck.brand} ${truck.modelCode}`} className="w-full h-full object-cover" />
        </div>
        {/* การ์ด spec: จอกว้างลอยทับมุมขวา · จอเล็กวางใต้รูป */}
        <div className="mt-4 md:mt-0 md:absolute md:right-6 md:-bottom-10">
          <SpecCard brand={truck.brand} modelCode={truck.modelCode} plate={truck.plate} specs={truck.specs} status={truck.status} />
        </div>
      </div>
      <div className="mt-6 md:mt-16">
        <PriceBlock price={truck.price} monthlyPayment={truck.monthlyPayment} />
      </div>
    </section>
  )
}

/** 3. Gallery — 4 มุม แถบ caption เขียว */
function Gallery({ items }: { items: GalleryItem[] }) {
  return (
    <section className="px-8 mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.slice(0, 4).map((g) => (
        <figure key={g.caption} className={`rounded-xl overflow-hidden bg-white ${T.shadowSoft}`}>
          <div className="aspect-[4/3] bg-[var(--mt-cream)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} alt={g.caption} className="w-full h-full object-cover" />
          </div>
          <figcaption className="bg-[var(--mt-green)] text-white text-xs font-semibold text-center py-1.5">{g.caption}</figcaption>
        </figure>
      ))}
    </section>
  )
}

/** 4. PromoBanner — "รับโปรโมชั่นพิเศษ 3 ต่อ!" */
function PromoBanner() {
  return (
    <section className={`mt-8 ${T.greenGrad} text-white px-8 py-5 flex flex-wrap items-center justify-between gap-3`}>
      <p className="text-2xl md:text-3xl font-black flex items-baseline gap-2">
        <Sparkles className="w-6 h-6 text-[var(--mt-gold)] self-center" />
        รับโปรโมชั่นพิเศษ
        <span className={`text-5xl md:text-6xl font-black leading-none ${T.goldText}`}>3</span>
        ต่อ!
      </p>
      <p className="italic text-sm md:text-base text-[var(--mt-gold-light)]">เป็นเจ้าของรถ…ง่ายกว่าที่คิด</p>
    </section>
  )
}

/** 5. PromoCard — การ์ดโปรฯ 1 ใบ (ใบแรกมีกล่องเน้นครีมขอบทอง) */
function PromoCard({ promo, highlight }: { promo: Promotion; highlight?: boolean }) {
  return (
    <article className={`relative rounded-2xl bg-white overflow-hidden ${T.shadowSoft} flex flex-col`}>
      <header className="bg-[var(--mt-green)] text-white px-4 py-3 rounded-b-2xl flex items-center gap-3">
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black text-[#3F3000] ${T.goldBg}`}>{promo.badge}</span>
        <h3 className="font-bold leading-tight">{promo.title}</h3>
      </header>
      <div className="px-4 pt-4 pb-16 text-sm leading-relaxed text-[var(--mt-green-dark)] flex-1">
        {promo.body}
        {highlight && (
          <div className="mt-3 rounded-xl border border-[var(--mt-gold)] bg-[var(--mt-cream)] px-3 py-2 text-xs font-semibold text-[var(--mt-green-dark)]">
            เงื่อนไข: ชำระค่างวดตรงเวลาต่อเนื่องตามรอบสัญญา
          </div>
        )}
      </div>
      {/* พื้นที่ไอคอน/รูปประกอบ มุมล่างขวา */}
      <div className="absolute right-3 bottom-3 text-[var(--mt-gold)] opacity-80">{promo.icon}</div>
    </article>
  )
}

/** ช่องกรอกแบบเส้นใต้ (ว่าง = เว้นที่ให้เขียนมือ) */
function Field({ value, placeholder }: { value?: string; placeholder: string }) {
  return (
    <p className="mt-1 min-w-[150px] border-b-2 border-[var(--mt-gold)] pb-0.5 text-base font-bold text-[var(--mt-green-dark)]">
      {value || <span className="text-transparent select-none">{placeholder}</span>}
    </p>
  )
}

/** 6. Footer — ช่องติดต่อ + โลโก้ + แถบทองปิดท้าย */
function Footer({ contactPhone, lineId }: { contactPhone?: string; lineId?: string }) {
  return (
    <footer className="mt-8">
      <div className="px-8 py-6 grid gap-6 md:grid-cols-3 items-center">
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-11 h-11 rounded-full bg-[var(--mt-green)] text-white grid place-items-center"><Phone className="w-5 h-5" /></span>
          <div>
            <p className="text-xs text-[var(--mt-green-light)]">สอบถาม / นัดดูรถ</p>
            <Field value={contactPhone} placeholder="0XX-XXX-XXXX" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-11 h-11 rounded-full bg-[#06C755] text-white grid place-items-center"><MessageCircle className="w-5 h-5" /></span>
          <div>
            <p className="text-xs text-[var(--mt-green-light)]">ติดต่อ LINE</p>
            <Field value={lineId} placeholder="@menatransport" />
          </div>
        </div>
        <div className="md:text-right">
          <p className="text-xl font-black tracking-wide text-[var(--mt-green-dark)]">MENA <span className={T.goldText}>TRANSPORT</span></p>
          <p className="text-[10px] tracking-[0.3em] text-[var(--mt-green-light)]">MOVE FOR A BETTER TOMORROW</p>
        </div>
      </div>
      <div className={`${T.goldBg} text-center text-[11px] font-bold tracking-[0.25em] text-[#3F3000] py-2`}>
        MENA TRANSPORT | USED MIXER TRUCK CATALOG
      </div>
    </footer>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TruckCatalogPoster({
  mode = "fluid",
  scale = 1,
  theme,
  ...data
}: TruckCatalogPosterProps) {
  const truck: TruckCatalog = { ...MOCK_TRUCK, ...data }
  const t = { ...DEFAULT_THEME, ...theme }

  // override โทเคนต่อ instance (ค่าเริ่มต้นอยู่บน :root)
  const vars = {
    "--mt-green-dark": t.greenDark, "--mt-green": t.green, "--mt-green-light": t.greenLight,
    "--mt-gold": t.gold, "--mt-gold-light": t.goldLight, "--mt-cream": t.cream, "--mt-white": t.white,
  } as CSSProperties

  const frame = mode === "fixed"
    ? { width: 1024, minHeight: 1536, transform: `scale(${scale})`, transformOrigin: "top left" }
    : { width: "100%", maxWidth: 1024 }

  return (
    <>
      <style>{ROOT_VARS}</style>
      <div
        data-truck-poster
        style={{ ...vars, ...frame }}
        className={`${T.font} relative overflow-hidden bg-[var(--mt-cream)] text-[var(--mt-green-dark)] print:w-[1024px] print:shadow-none ${mode === "fluid" ? "mx-auto" : ""}`}
      >
        <Header quote={truck.quote} highlights={truck.highlights} />
        <HeroSection truck={truck} />
        <Gallery items={truck.gallery} />
        <PromoBanner />
        <section className="px-8 mt-6 grid gap-4 md:grid-cols-3">
          {truck.promotions.slice(0, 3).map((p, i) => <PromoCard key={p.badge} promo={p} highlight={i === 0} />)}
        </section>
        <Footer contactPhone={truck.contactPhone} lineId={truck.lineId} />
      </div>
    </>
  )
}
