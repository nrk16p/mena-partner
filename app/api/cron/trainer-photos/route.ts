import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { planTrainerPhotos, applyTrainerPhotos } from "@/lib/trainer-photos"
import { revalidatePublicTrucks } from "@/lib/revalidate-public"

export const runtime = "nodejs"
export const maxDuration = 300

const DB = process.env.MONGO_DB ?? "mena_partner"

/**
 * ดึงรูปรถจาก Trainer App ทุกวัน (ผู้ใช้สั่ง 2026-11-13 "always sync with latest month") — Vercel Cron ตั้งใน vercel.json
 * ใช้เดือนล่าสุดที่มีงานตรวจ + เดือนก่อน (ต้นเดือนยังตรวจไม่ครบ) รอบตรวจล่าสุดต่อคันชนะ · รอบที่ดึงไปแล้วข้าม ไม่ copy ซ้ำ
 * Cron ของ Vercel แนบ Authorization: Bearer <CRON_SECRET> · ผู้ดูแลยิงเองได้ (มือเปล่า = พรีวิว, ?apply=1 = ทำจริง)
 */
async function allowed(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return "cron"
  const session = await getServerSession(authOptions)
  return ["admin", "superadmin"].includes(session?.user?.role ?? "") ? "admin" : false
}

export async function GET(req: NextRequest) {
  const who = await allowed(req)
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const apply = who === "cron" || req.nextUrl.searchParams.get("apply") === "1"
  const db = (await clientPromise).db(DB)
  const plan = await planTrainerPhotos(db)
  const res = apply ? await applyTrainerPhotos(db, plan, "cron (ดึงรูปจาก Trainer App)") : plan
  if (apply && (res.written ?? 0) > 0) revalidatePublicTrucks()
  return NextResponse.json({
    ok: true, mode: apply ? "apply" : "preview",
    months: res.months, withPhotos: res.withPhotos, toUpdate: res.plans.length,
    written: res.written, copied: res.copied, errors: res.errors,
  })
}
