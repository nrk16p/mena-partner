import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongo"

const DB = process.env.MONGO_DB ?? "mena_partner"

export async function POST(req: Request) {
  const body = await req.json()
  const { contractCode, date, description, amount } = body
  if (!contractCode || !date || !description || amount == null) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 })
  }
  const client = await clientPromise
  const db = client.db(DB)
  const doc = {
    contractCode: String(contractCode),
    date: String(date),
    description: String(description),
    amount: Number(amount),
    createdAt: new Date(),
  }
  const result = await db.collection("repair_claims").insertOne(doc)
  return NextResponse.json({ _id: result.insertedId.toString(), ...doc }, { status: 201 })
}
