import type { NextConfig } from "next";

/**
 * ย้าย API ไป mena-backend-services: ตั้ง BACKEND_API_URL (เช่น https://seahorse-app-o3p3o.ondigitalocean.app)
 * ใน Vercel แล้ว redeploy → /api/* วิ่งไป <BACKEND_API_URL>/api/v1/partner/* · ไม่ตั้ง = ใช้ route เดิมในแอป
 * ที่ยังอยู่ที่นี่: /api/auth/* (ล็อกอิน NextAuth) · /api/cron/* (Vercel cron) · /api/revalidate-hook (ล้างแคชหน้า /trucks)
 */
const backend = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backend) return [];
    return {
      beforeFiles: [
        {
          source: "/api/:path((?!(?:auth|cron|revalidate-hook)(?:/|$)).+)",
          destination: `${backend}/api/v1/partner/:path`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // ตัด JS ที่ไม่ได้ใช้จาก icon/util libraries ให้ tree-shake แม่นขึ้น
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  // pdfmake มีไฟล์ data ภายใน — อย่า bundle ให้รันจาก node_modules
  serverExternalPackages: ["pdfmake", "sharp"],
  // รวม template .docx + ฟอนต์ CordiaUPC (สำหรับ pdfmake) เข้า serverless bundle
  outputFileTracingIncludes: {
    "/api/contracts/[id]/docx": ["./templates/**"],
    "/api/contracts/[id]/pdf": ["./fonts/**"],
    "/api/quotations/[id]/pdf": ["./fonts/**"],
    "/api/catalog/[plate]/pdf": ["./fonts/**"],
    "/api/catalog/pdf": ["./fonts/**"],
    "/og/truck/[slug]": ["./fonts/**"],
  },
  // ย่อรูปเองที่ /api/public/img แทน /_next/image — โควตาย่อรูปฟรีของ Vercel หมดแล้วรูปหาย (402)
  // รายละเอียด + โฮสต์ที่อนุญาต อยู่ใน lib/image-proxy.ts
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
};

export default nextConfig;
