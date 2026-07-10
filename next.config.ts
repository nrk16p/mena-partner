import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ตัด JS ที่ไม่ได้ใช้จาก icon/util libraries ให้ tree-shake แม่นขึ้น
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  // รวมไฟล์ .docx template + asset ของตัวแปลง PDF เข้า serverless bundle (Vercel)
  outputFileTracingIncludes: {
    "/api/contracts/[id]/docx": ["./templates/**"],
    "/api/contracts/[id]/pdf": [
      "./templates/**",
      "./lib/pdf-assets/**",
      "./node_modules/@sparticuz/chromium/**",
    ],
  },
  // รูปอัปโหลด (สำเนาเอกสาร) เสิร์ฟผ่าน next/image ได้เร็วขึ้น
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
