import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "contracts"

type Ctx = { params: Promise<{ id: string }> }

// เฉพาะ field ไฟล์แนบ 5 ชนิด — จัดการได้ทุก user ที่ login (ไม่ใช่แก้ข้อมูลสัญญา)
const ATTACH_FIELDS = new Set([
  "saleContractUrl", "promotionDocUrl", "hireContractUrl", "guaranteeContractUrl", "creditorDocUrl",
])

/** PATCH /api/contracts/[id]/attachment — แนบ/ลบ ไฟล์เอกสาร (url = "" คือลบ) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json() as { field?: string; url?: string }
  const field = body.field ?? ""
  if (!ATTACH_FIELDS.has(field)) {
    return NextResponse.json({ error: "invalid attachment field" }, { status: 400 })
  }
  const url = typeof body.url === "string" ? body.url.trim() : ""

  const client = await clientPromise
  const res = await client.db(DB).collection(COLL).updateOne(
    { _id: new ObjectId(id) },
    { $set: { [field]: url, updatedAt: new Date().toISOString() } },
  )
  if (res.matchedCount === 0) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
