import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { domainOfApiPath, hasPerm, isAdminRole, canUpload } from "@/lib/rbac"

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

  // ── เขียน (non-GET): เช็คสิทธิ์ตาม RBAC matrix (lib/rbac.ts) ──
  if (!READ_METHODS.has(request.method) && pathname.startsWith("/api/")) {
    const role = (token.role as string) ?? "viewer"

    // team tracker หน้าแรก — ทุกคนที่ login ติ๊กได้ (พฤติกรรมเดิม)
    if (pathname.startsWith("/api/module-status")) return NextResponse.next()

    // อัปโหลดไฟล์ — ทุกบทบาทที่มีสิทธิ์เขียนอย่างน้อยหนึ่งโดเมน
    if (pathname.startsWith("/api/upload")) {
      return canUpload(role)
        ? NextResponse.next()
        : NextResponse.json({ error: "Forbidden — ไม่มีสิทธิ์อัปโหลด" }, { status: 403 })
    }

    // ลบข้อมูล = admin ขึ้นไปเท่านั้น (ทุก endpoint)
    if (request.method === "DELETE" && !isAdminRole(role)) {
      return NextResponse.json({ error: "Forbidden — ลบข้อมูลได้เฉพาะแอดมิน" }, { status: 403 })
    }

    const domain = domainOfApiPath(pathname)
    if (domain === null) {
      // path ที่ไม่อยู่ใน map = default-closed (admin ขึ้นไป)
      if (!isAdminRole(role)) {
        return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
      }
    } else if (!hasPerm(role, domain)) {
      return NextResponse.json({ error: "Forbidden — ไม่มีสิทธิ์ในส่วนนี้" }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot)$).*)"],
}
