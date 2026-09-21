import TruckCatalogPoster, { MOCK_TRUCK } from "@/components/catalog/truck-catalog-poster"
import { PosterDownloadButton } from "@/components/catalog/poster-download-button"

/** Preview โปสเตอร์แคตตาล็อก (mock NISSAN ME135) — ?fixed=1 = โหมด 1024px · ปุ่มดาวน์โหลด PNG 1024px */
export default async function CatalogPosterPreview({ searchParams }: { searchParams: Promise<{ fixed?: string }> }) {
  const { fixed } = await searchParams
  const poster = { ...MOCK_TRUCK }
  return (
    <div className="-m-5 sm:-m-7 min-h-full bg-zinc-200 dark:bg-zinc-800 p-6 overflow-auto">
      <div className="max-w-[1024px] mx-auto mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">โปสเตอร์ {poster.brand} {poster.modelCode} · {poster.plate}</p>
        <PosterDownloadButton poster={poster} fileName={`poster-${poster.modelCode}`} />
      </div>
      <TruckCatalogPoster {...poster} mode={fixed ? "fixed" : "fluid"} />
    </div>
  )
}
