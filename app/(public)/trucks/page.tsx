import type { Metadata } from "next"
import { loadPublicTrucks } from "@/lib/public-trucks"
import { siteUrl } from "@/lib/public-seo"
import { TruckBrowser } from "@/components/public/truck-browser"

export const revalidate = 600

export const metadata: Metadata = {
  title: "รถผสมปูน (มิกเซอร์) มือสอง พร้อมงานวิ่ง | มีนา ทรานสปอร์ต",
  description: "รถผสมปูนมือสองจากกองรถบริษัท เจ้าของเดียว มีประวัติซ่อมบำรุงครบ ผ่อนกับบริษัทโดยตรง พร้อมงานวิ่งรองรับ",
  alternates: { canonical: siteUrl("/trucks") },
}

export default async function TrucksPage() {
  const trucks = await loadPublicTrucks()
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold">รถผสมปูน (มิกเซอร์) มือสอง</h1>
      <p className="text-zinc-600 mt-2 max-w-2xl">
        รถจากกองรถของบริษัทเอง เจ้าของเดียว มีประวัติการซ่อมบำรุงครบทุกครั้ง
        ผ่อนชำระกับบริษัทโดยตรง และมีงานวิ่งรองรับตั้งแต่วันแรก
      </p>
      <div className="mt-8">
        <TruckBrowser trucks={trucks} />
      </div>
    </div>
  )
}
