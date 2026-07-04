import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB   = process.env.MONGO_DB ?? "mena_partner"
const COLL = "contracts"
const PREFIX = "MTL-"

export async function GET() {
  const client = await clientPromise
  const codes  = await client.db(DB).collection(COLL)
    .find({ contractCode: { $regex: `^${PREFIX}` } }, { projection: { contractCode: 1 } })
    .toArray()

  let max = 0
  for (const c of codes) {
    const n = parseInt((c.contractCode as string).replace(PREFIX, ""), 10)
    if (!isNaN(n) && n > max) max = n
  }

  const next = `${PREFIX}${String(max + 1).padStart(3, "0")}`
  return NextResponse.json({ code: next })
}
