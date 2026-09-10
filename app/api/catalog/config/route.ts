import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongo"
import { hasPerm } from "@/lib/rbac"
import { CATALOG_COLL, DEFAULT_CATALOG_CONFIG, getCatalogConfig, sanitizeCatalogConfig, type CatalogConfig } from "@/lib/catalog-config"

const DB = process.env.MONGO_DB ?? "mena_partner"

/** template ข้อความ Catalog — GET ทุกคนที่ล็อกอิน · PUT สิทธิ์ masterdata (admin/fleet) */
export async function GET() {
  const client = await clientPromise
  return NextResponse.json({ config: await getCatalogConfig(client.db(DB)), defaults: DEFAULT_CATALOG_CONFIG })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!hasPerm(role, "masterdata")) return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ template" }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as Partial<CatalogConfig>
  const cfg = sanitizeCatalogConfig(body)
  const client = await clientPromise
  await client.db(DB).collection(CATALOG_COLL).updateOne(
    { _id: "default" as unknown as never },
    { $set: { ...cfg, updatedAt: new Date().toISOString(), updatedBy: session?.user?.email ?? "unknown" } },
    { upsert: true },
  )
  return NextResponse.json({ ok: true, config: await getCatalogConfig(client.db(DB)) })
}
