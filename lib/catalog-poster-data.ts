import "server-only"
import type { Db } from "mongodb"
import { loadCatalogVehicles, type CatalogVehicle } from "@/lib/catalog-pdf"
import { getCatalogConfig, type CatalogConfig } from "@/lib/catalog-config"
import type { TruckCatalog } from "@/components/catalog/truck-catalog-poster"

/**
 * แปลงข้อมูลรถ (ชุดเดียวกับ Catalog PDF) → props ของ TruckCatalogPoster
 * ข้อความ quote/จุดขาย/ติดต่อ มาจาก catalog_config ที่ admin แก้ได้ที่ /catalog
 */

const SALE_STATUS_LABEL: Record<string, string> = {
  ready: "พร้อมขาย", repair15: "ซ่อม 15 วัน", repair30: "ซ่อม 30 วัน", review: "รอตรวจสภาพ",
}
/** ราคาบนโปสเตอร์ปัดขึ้นเป็นเลขกลม: ราคารถ → หมื่น, ค่างวด → ร้อย (ตัวเลขจริงยังอยู่ใน PDF/ระบบ) */
const ceilTo = (n: number, unit: number) => (n > 0 ? Math.ceil(n / unit) * unit : 0)
const beYear = (d?: string) => { const y = Number(String(d ?? "").slice(0, 4)); return y > 1900 ? y + 543 : null }

/** promoLines (ข้อความสำเร็จรูป) → การ์ดโปรฯ: ชื่อสั้นตามชนิด, เนื้อหา = บรรทัดเต็ม */
function promotionsFrom(lines: string[]): TruckCatalog["promotions"] {
  const title = (l: string) =>
    l.startsWith("ฟรีค่างวด") ? "ฟรีค่างวด" : l.startsWith("ฟรีค่าซ่อม") ? "ฟรีค่าซ่อมบำรุง" : l.startsWith("ฟรี PM") ? "ฟรี PM ทุกปี" : l.slice(0, 24)
  return lines.slice(0, 3).map((l, i) => ({ badge: `ต่อที่ ${i + 1}`, title: title(l), body: l }))
}

export function toPosterData(v: CatalogVehicle, cfg: CatalogConfig): TruckCatalog {
  const ph = v.photos ?? {}
  // รูปแรก = ด้านซ้าย (เห็นตัวรถทั้งคัน) ถ้าไม่มีค่อยถอยไปหน้า
  const year = beYear(v.registrationDate)
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
    price: ceilTo(v.totalSalePrice ?? 0, 10_000),
    monthlyPayment: ceilTo(v.monthlyPayment ?? 0, 100),
    installments: v.financeInstallments || undefined,
    heroImage: ph.left || ph.front || v.photoUrl || "",
    gallery: [
      { src: ph.front ?? "", caption: "ด้านหน้า" },
      { src: ph.back ?? "", caption: "ด้านหลัง" },
      { src: ph.right ?? "", caption: "ด้านขวา" },
      { src: ph.left ?? "", caption: "ด้านซ้าย" },
    ].filter((g) => g.src),
    quote: cfg.tagline,
    highlights: cfg.sellingPoints.slice(0, 3),
    promotions: promotionsFrom(v.promoLines),
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
