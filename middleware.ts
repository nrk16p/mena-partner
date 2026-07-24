import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow auth API and login page through
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    return NextResponse.next()
  }

  // Verify JWT — getToken returns null for missing, expired, or tampered tokens
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Write routes: admin only — ยกเว้นเส้นทางที่อนุญาตให้ user ทั่วไปเขียนได้
  // (price-list: เพิ่ม/แก้ราคา + สถานะความพร้อมขาย — ตามข้อกำหนด 2026-07-15)
  const userWritable =
    pathname.startsWith("/api/price-list") ||
    // สถานะความคืบหน้าโมดูล (ติ๊กข้อมูลครบ/วันคาดเสร็จ ในหน้าแรก) — ทุกคนที่ login แก้ได้
    pathname.startsWith("/api/module-status") ||
    // จัดการไฟล์แนบสัญญา (แนบ/ลบ) — เฉพาะ endpoint attachment ไม่ใช่แก้ข้อมูลสัญญา
    (pathname.startsWith("/api/contracts/") && pathname.endsWith("/attachment"))
  if (!READ_METHODS.has(request.method) && token.role !== "admin" && !userWritable) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot)$).*)"],
}
