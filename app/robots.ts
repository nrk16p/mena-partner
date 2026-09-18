import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/public-seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/trucks", "/og/"],
      disallow: ["/api/", "/admin/", "/login", "/payroll", "/drivers", "/contracts", "/vehicle-cost", "/vehicles", "/quotations", "/reports", "/catalog", "/price-list", "/promotions"],
    }],
    sitemap: siteUrl("/sitemap.xml"),
  }
}
