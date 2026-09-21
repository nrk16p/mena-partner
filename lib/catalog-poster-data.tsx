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
/** ราคาบนโปสเตอร์ปัดขึ้นเป็นเลขกลม: ราคารถ → พัน (1,234,567 → 1,235,000), ค่างวด → ร้อย (ตัวเลขจริงยังอยู่ใน PDF/ระบบ) */
const ceilTo = (n: number, unit: number) => (n > 0 ? Math.ceil(n / unit) * unit : 0)
const beYear = (d?: string) => { const y = Number(String(d ?? "").slice(0, 4)); return y > 1900 ? y + 543 : null }

const fm = (n: number) => n.toLocaleString("en-US")
const B = ({ children }: { children: React.ReactNode }) => <b className="text-[var(--mt-green)]">{children}</b>

/**
 * การ์ดโปรฯ 3 ต่อ ข้อความตามที่ฝ่ายขายเคาะ (2026-09-21) — ตัวเลขดึงจาก promotion_master
 * ต่อที่ 1: "ผ่อนครบทุก ๆ N งวด รับฟรีงวดที่ …" — งวดที่ฟรี = k×(N+M) จากเงื่อนไข "N ฟรี M" ตามจำนวนครั้งที่ฟรี
 */
function promotionsFrom(v: CatalogVehicle): TruckCatalog["promotions"] {
  const m = v.promo
  if (!m) return []
  const out: TruckCatalog["promotions"] = []
  if (m.pro1TotalValue > 0 || m.pro1FreeCount > 0) {
    const [, payN = "9", freeM = "1"] = m.pro1Condition.match(/(\d+)\s*ฟรี\s*(\d+)/) ?? []
    const cycle = Number(payN) + Number(freeM)
    const freeAt = Array.from({ length: m.pro1FreeCount }, (_, k) => (k + 1) * cycle)
    out.push({
      badge: "ต่อที่ 1", title: "ฟรีค่างวด",
      body: <>ผ่อนค่างวดครบทุก ๆ <B>{payN} งวด</B> รับฟรีงวดที่ <B>{freeAt.join(",")}</B><br />รวมรับฟรี <B>{m.pro1FreeCount} งวด</B> มูลค่ารวม <B>{fm(m.pro1TotalValue)} บาท</B></>,
    })
  }
  if (m.pro2RepairBudget > 0) {
    out.push({
      badge: `ต่อที่ ${out.length + 1}`, title: "ฟรีค่าซ่อมบำรุง",
      body: <>ฟรีค่าซ่อมบำรุง วงเงิน <B>{fm(m.pro2RepairBudget)} บาท</B></>,
    })
  }
  if (m.pro3AnnualPm > 0) {
    out.push({
      badge: `ต่อที่ ${out.length + 1}`, title: "ฟรีเปลี่ยนถ่ายน้ำมันเครื่อง (PM)",
      body: <>ฟรีเปลี่ยนถ่ายน้ำมันเครื่อง ไส้กรอง และของเหลวสำคัญตามระยะ ทุก ๆ <B>6 เดือน</B> *<br />PM (บำรุงรักษาเชิงป้องกัน) มูลค่ารวมไม่เกิน <B>{fm(m.pro3AnnualPm)} บาท/ปี</B></>,
      note: "*เงื่อนไขอาจมีการเปลี่ยนแปลง เป็นไปตามที่บริษัทกำหนด",
    })
  }
  return out
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
    price: ceilTo(v.totalSalePrice ?? 0, 1_000),
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
