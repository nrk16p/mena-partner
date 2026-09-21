import Image from "next/image"
import Link from "next/link"
import { fmtBaht } from "@/lib/public-seo"
import type { PublicTruck } from "@/lib/public-trucks"

export function TruckCard({ truck }: { truck: PublicTruck }) {
  const year = truck.registrationYear
  const title = [truck.brand, truck.model].filter(Boolean).join(" ") || "รถผสมปูนมือสอง"
  return (
    <Link href={`/trucks/${truck.slug}`} className="group block rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-lg transition-shadow bg-white">
      <div className="relative aspect-[4/3] bg-zinc-100">
        {truck.photoUrl ? (
          <Image src={truck.photoUrl} alt={`${title}${year ? ` ปี ${year + 543}` : ""} มือสอง`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover group-hover:scale-[1.02] transition-transform" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">รูปกำลังอัปเดต</div>
        )}
        {truck.promoLines.length > 0 && (
          <span className="absolute top-3 left-3 rounded-full bg-amber-500 text-white text-[11px] font-semibold px-2.5 py-1">โปรฯ ติดรถ</span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold leading-tight">{title}{year ? ` ปี ${year + 543}` : ""}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{[truck.characteristic, truck.vehicleType].filter(Boolean).join(" · ")}</p>
        <p className="text-xl font-bold mt-2">฿{fmtBaht(truck.totalSalePrice)}</p>
        {truck.monthlyPayment > 0 && (
          <p className="text-sm text-emerald-700 font-medium">ผ่อน ฿{fmtBaht(truck.monthlyPayment)}/เดือน</p>
        )}
      </div>
    </Link>
  )
}
