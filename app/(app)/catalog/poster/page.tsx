import TruckCatalogPoster from "@/components/catalog/truck-catalog-poster"

/** Preview โปสเตอร์แคตตาล็อก (mock NISSAN ME135) — ?fixed=1 = โหมด 1024px สำหรับ export */
export default async function CatalogPosterPreview({ searchParams }: { searchParams: Promise<{ fixed?: string }> }) {
  const { fixed } = await searchParams
  return (
    <div className="-m-5 sm:-m-7 min-h-full bg-zinc-200 dark:bg-zinc-800 p-6 overflow-auto">
      <TruckCatalogPoster mode={fixed ? "fixed" : "fluid"} />
    </div>
  )
}
