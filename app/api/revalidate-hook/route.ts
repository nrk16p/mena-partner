import { NextResponse, type NextRequest } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * ล้างแคชหน้าที่ยัง render บน Vercel (เช่น /trucks) — mena-backend-services เรียกเส้นนี้ทุกครั้งที่ API
 * ฝั่งโน้นสั่ง revalidatePath/revalidateTag · ส่งคุกกี้ของผู้ใช้ที่ทำรายการมาด้วย ต้องล็อกอินอยู่ถึงจะล้างได้
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { path?: unknown; type?: unknown; tag?: unknown } | null
  if (typeof body?.path === "string" && body.path.startsWith("/")) {
    revalidatePath(body.path, body.type === "page" || body.type === "layout" ? body.type : undefined)
  } else if (typeof body?.tag === "string" && body.tag) {
    revalidateTag(body.tag, "max")
  } else {
    return NextResponse.json({ error: "ต้องระบุ path หรือ tag" }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
