import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ตัด JS ที่ไม่ได้ใช้จาก icon/util libraries ให้ tree-shake แม่นขึ้น
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  // pdfmake มีไฟล์ data ภายใน — อย่า bundle ให้รันจาก node_modules
  serverExternalPackages: ["pdfmake"],
  // รวม template .docx + ฟอนต์ CordiaUPC (สำหรับ pdfmake) เข้า serverless bundle
  outputFileTracingIncludes: {
    "/api/contracts/[id]/docx": ["./templates/**"],
    "/api/contracts/[id]/pdf": ["./fonts/**"],
  },
  // รูปอัปโหลด (สำเนาเอกสาร) เสิร์ฟผ่าน next/image ได้เร็วขึ้น
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
