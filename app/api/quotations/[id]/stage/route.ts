import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { moveStage, holdDeal, resumeDeal, closeLost, attachFile, getDeal, type Actor } from "@/lib/deal-actions"
import { checkAdvance, screeningChecklist, type DealFields } from "@/lib/deal-stage"
import { listLossReasons, reasonsForStage } from "@/lib/loss-reason"

const DB = process.env.MONGO_DB ?? "mena_partner"

/**
 * การกระทำกับดีลในไปป์ไลน์ — กติกาทั้งหมดตรวจซ้ำฝั่ง server เสมอ
 * (หน้าเว็บตรวจให้ผู้ใช้เห็นก่อน แต่เรียก API ตรงก็ต้องผ่านกติกาเดียวกัน)
 */

type Ctx = { params: Promise<{ id: string }> }

/** GET — สิ่งที่ต้องใช้บนหน้าดีล: ขยับได้ไหม ขาดอะไร เช็กลิสต์ และเหตุผลที่เลือกได้ */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = (await clientPromise).db(DB)
  const deal = await getDeal(db, id)
  if (!deal) return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 })

  const stage = String(deal.stage ?? "LEAD")
  const lostAt = stage === "ON_HOLD" ? String(deal.stageBeforeHold ?? "LEAD") : stage
  const reasons = await listLossReasons(db)

  return NextResponse.json({
    stage,
    advance: checkAdvance(deal as DealFields),
    screening: screeningChecklist(deal as DealFields),
    lossReasons: reasonsForStage(reasons, lostAt),
  })
}

/** POST — action: advance | move | hold | resume | close | attach */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actor: Actor = {
    email: session.user.email,
    isAdmin: ["admin", "superadmin"].includes(session.user.role ?? ""),
  }
  const b = await req.json().catch(() => null)
  if (!b?.action) return NextResponse.json({ error: "ไม่ได้ระบุการกระทำ" }, { status: 400 })

  const db = (await clientPromise).db(DB)
  let result

  switch (b.action) {
    case "advance": {
      const deal = await getDeal(db, id)
      if (!deal) return NextResponse.json({ error: "ไม่พบดีล" }, { status: 404 })
      const next = checkAdvance(deal as DealFields)
      if (!next.to) return NextResponse.json({ error: next.error ?? "ขยับต่อไม่ได้" }, { status: 400 })
      result = await moveStage(db, id, next.to, actor, b.note)
      break
    }
    case "move":
      result = await moveStage(db, id, String(b.to ?? ""), actor, b.note)
      break
    case "hold":
      result = await holdDeal(db, id, actor, String(b.holdReason ?? ""), String(b.nextFollowUpDate ?? ""))
      break
    case "resume":
      result = await resumeDeal(db, id, actor)
      break
    case "close":
      result = await closeLost(db, id, actor, String(b.lossReasonId ?? ""), b.lossNote)
      break
    case "attach":
      result = await attachFile(db, id, actor, String(b.type ?? ""), String(b.url ?? ""), b.label)
      break
    default:
      return NextResponse.json({ error: "การกระทำไม่ถูกต้อง" }, { status: 400 })
  }

  if (!result.ok) {
    const missing = result.missing ?? []
    const error = result.error ?? (missing.length ? `ข้อมูลบังคับยังไม่ครบ: ${missing.join(" · ")}` : "ทำรายการไม่ได้")
    return NextResponse.json({ error, missing }, { status: 400 })
  }
  const deal = await getDeal(db, id)
  return NextResponse.json({ ok: true, deal: { ...deal, _id: String(deal?._id) } })
}
