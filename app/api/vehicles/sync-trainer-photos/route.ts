import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { resolveRole } from "@/lib/roles"
import { hasPerm } from "@/lib/rbac"
import { planTrainerPhotos, applyTrainerPhotos } from "@/lib/trainer-photos"
import { revalidatePublicTrucks } from "@/lib/revalidate-public"

export const maxDuration = 300

const DB = process.env.MONGO_DB ?? "mena_partner"

/** ?month=2026-11,2026-10 — ไม่ส่ง = เดือนล่าสุดที่มีงานตรวจ + เดือนก่อนหน้า */
const monthsOf = (req: NextRequest) =>
  (req.nextUrl.searchParams.get("month") ?? "").split(",").map((m) => m.trim()).filter((m) => /^\d{4}-\d{2}$/.test(m))

async function guard() {
  const session = await getServerSession(authOptions)
  const role = await resolveRole(session?.user?.email)
  if (!hasPerm(role, "masterdata")) return { error: NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 }) }
  return { email: session?.user?.email ?? "unknown" }
}

/**
 * GET  /api/vehicles/sync-trainer-photos — ดูก่อน (dry-run) ว่าจะดึงรูปรถคันไหนจาก Trainer App
 * POST /api/vehicles/sync-trainer-photos — ดึงจริง: copy รูปจาก S3 (trainer-app/…) เป็น public แล้วเขียน vehicle_master.photos
 * รายละเอียด/นโยบายทับรูปอยู่ที่ lib/trainer-photos.ts
 */
export async function GET(req: NextRequest) {
  const g = await guard(); if ("error" in g) return g.error
  const db = (await clientPromise).db(DB)
  const plan = await planTrainerPhotos(db, monthsOf(req))
  return NextResponse.json(summary(plan))
}

export async function POST(req: NextRequest) {
  const g = await guard(); if ("error" in g) return g.error
  const db = (await clientPromise).db(DB)
  const plan = await planTrainerPhotos(db, monthsOf(req))
  const res = await applyTrainerPhotos(db, plan, `${g.email} (ดึงรูปจาก Trainer App)`)
  revalidatePublicTrucks()
  return NextResponse.json(summary(res))
}

function summary(r: Awaited<ReturnType<typeof planTrainerPhotos>> & { written?: number; copied?: number; errors?: string[] }) {
  return {
    months: r.months, inspections: r.inspections, platesInPriceList: r.platesInPriceList,
    withPhotos: r.withPhotos, photosToWrite: r.plans.reduce((s, p) => s + p.replace.length, 0),
    keptManual: r.plans.filter((p) => p.keptManual.length).map((p) => p.plate),
    noPhotoFolder: r.noPhotoFolder,
    written: r.written, copied: r.copied, errors: r.errors,
    plans: r.plans.map((p) => ({ plate: p.plate, taskId: p.taskId, inspectedAt: p.inspectedAt, sides: p.replace })),
  }
}
