import { NextResponse } from "next/server"
import { loadPublicTrucks } from "@/lib/public-trucks"

export const revalidate = 600

/** API สาธารณะ — ข้อมูลผ่าน toPublicTruck() allowlist เท่านั้น (ดู lib/public-trucks.ts) */
export async function GET() {
  const trucks = await loadPublicTrucks()
  return NextResponse.json({ trucks, count: trucks.length })
}
