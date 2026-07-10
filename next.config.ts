import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ตัด JS ที่ไม่ได้ใช้จาก icon/util libraries ให้ tree-shake แม่นขึ้น
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  // รวมไฟล์ .docx template เข้า serverless bundle ของ route ที่สร้างเอกสาร (Vercel)
  outputFileTracingIncludes: {
    "/api/contracts/[id]/docx": ["./templates/**"],
  },
  // รูปอัปโหลด (สำเนาเอกสาร) เสิร์ฟผ่าน next/image ได้เร็วขึ้น
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
