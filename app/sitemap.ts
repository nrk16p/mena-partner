import type { MetadataRoute } from "next"
import { loadPublicTrucks } from "@/lib/public-trucks"
import { siteUrl } from "@/lib/public-seo"

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const trucks = await loadPublicTrucks()   // เฉพาะรถพร้อมขาย — ที่ขายแล้วไม่เข้า sitemap
  return [
    { url: siteUrl("/trucks"), changeFrequency: "daily", priority: 1 },
    ...trucks.map((t) => ({
      url: siteUrl(`/trucks/${t.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ]
}
