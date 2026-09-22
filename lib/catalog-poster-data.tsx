import "server-only"
import type { Db } from "mongodb"
import { loadCatalogVehicles, type CatalogVehicle } from "@/lib/catalog-pdf"
import { getCatalogConfig, type CatalogConfig } from "@/lib/catalog-config"
import type { TruckCatalog } from "@/components/catalog/truck-catalog-poster"
import { promoCopy, type PromoSeg } from "@/lib/promo-copy"

/**
 * แปลงข้อมูลรถ (ชุดเดียวกับ Catalog PDF) → props ของ TruckCatalogPoster
 * ข้อความ quote/จุดขาย/ติดต่อ มาจาก catalog_config ที่ admin แก้ได้ที่ /catalog
 */

const SALE_STATUS_LABEL: Record<string, string> = {
  ready: "พร้อมขาย", repair15: "ซ่อม 15 วัน", repair30: "ซ่อม 30 วัน", review: "รอตรวจสภาพ",
}
/** ปัดขึ้นเป็นเลขกลม: ค่างวด → ร้อย, ราคารถ (กรณีไม่มีแผนผ่อน) → พัน — ตัวเลขจริงยังอยู่ใน PDF/ระบบ */
const ceilTo = (n: number, unit: number) => (n > 0 ? Math.ceil(n / unit) * unit : 0)
const beYear = (d?: string) => { const y = Number(String(d ?? "").slice(0, 4)); return y > 1900 ? y + 543 : null }

const B = ({ children }: { children: React.ReactNode }) => <b className="text-[var(--mt-green)]">{children}</b>
const seg = (s: PromoSeg, i: number) =>
  typeof s === "string" ? s
    : "b" in s ? <B key={i}>{s.b}</B>
    : <span key={i} className="text-2xl @3xl:text-[28px] leading-snug font-black text-[var(--mt-green)]">{s.big}</span>

/** การ์ดโปรฯ 3 ต่อ — ถ้อยคำอยู่ที่ lib/promo-copy (ชุดเดียวกับหน้า /trucks และ Catalog PDF) */
function promotionsFrom(v: CatalogVehicle): TruckCatalog["promotions"] {
  return promoCopy(v.promo).map((p) => ({
    badge: p.badge, title: p.title, titleParts: p.titleParts, note: p.note,
    // 1 บรรทัดใน promo-copy = 1 บรรทัดบนการ์ด (ไม่ปล่อยให้ตัดคำเอง)
    body: <>{p.lines.map((l, i) => <span key={i} className="block">{l.map(seg)}</span>)}</>,
  }))
}

export function toPosterData(v: CatalogVehicle, cfg: CatalogConfig): TruckCatalog {
  const ph = v.photos ?? {}
  // รูปแรก = ด้านซ้าย (เห็นตัวรถทั้งคัน) ถ้าไม่มีค่อยถอยไปหน้า
  const year = beYear(v.registrationDate)
  // ราคาต้องลงตัวกับแผนผ่อน (ฝ่ายขาย 2026-09-22): ราคา = ดาวน์ + ค่างวดที่ปัดแล้ว × งวด
  // เช่น 100,000 + 17,200 × 72 = 1,338,400 (ในระบบ 1,335,728) · ไม่มีแผนผ่อน → ปัดราคาเต็มพัน
  const monthly = ceilTo(v.monthlyPayment ?? 0, 100)
  const count = v.financeInstallments ?? 0
  const down = v.downPayment ?? 0
  return {
    brand: v.brand || "—",
    modelCode: v.truckNumber || "",
    plate: v.licensePlate,
    specs: [
      { label: "รุ่น", value: v.model || "—" },
      { label: "ประเภทรถ", value: [v.vehicleType, v.characteristic].filter(Boolean).join(" ") || "—" },
      { label: "ปีจดทะเบียน", value: year ? String(year) : "—" },
    ],
    status: SALE_STATUS_LABEL[v.saleStatus ?? ""] ?? (v.saleStatus || "—"),
    price: monthly > 0 && count > 0 ? down + monthly * count : ceilTo(v.totalSalePrice ?? 0, 1_000),
    downPayment: down > 0 ? down : undefined,
    monthlyPayment: monthly,
    installments: count || undefined,
    heroImage: ph.left || ph.front || v.photoUrl || "",
    gallery: [
      { src: ph.front ?? "", caption: "ด้านหน้า" },
      { src: ph.back ?? "", caption: "ด้านหลัง" },
      { src: ph.right ?? "", caption: "ด้านขวา" },
      { src: ph.left ?? "", caption: "ด้านซ้าย" },
    ].filter((g) => g.src),
    quote: cfg.tagline,
    highlights: cfg.sellingPoints.slice(0, 3),
    promotions: promotionsFrom(v),
    contactPhone: cfg.contactPhone,
    lineId: cfg.contactLine,
    logoUrl: "/mena-logo.jpg",
  }
}

/** โหลดข้อมูลโปสเตอร์ของทะเบียนเดียว — null ถ้าไม่พบรถ */
export async function loadPosterData(db: Db, plate: string): Promise<TruckCatalog | null> {
  const [vs, cfg] = await Promise.all([loadCatalogVehicles(db, [plate]), getCatalogConfig(db)])
  if (vs.length === 0) return null
  return toPosterData(vs[0], cfg)
}
