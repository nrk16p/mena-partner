import type { Db } from "mongodb"

/** ใครเป็นคนกดบันทึก — เก็บแยกจาก "เซลล์เจ้าของดีล" เพราะบางคนฝากเพื่อนร่วมทีม/แอดมินคีย์ให้ */
export type Actor = { email: string; name: string }

export function actorOf(session: { user?: { email?: string | null; name?: string | null } } | null): Actor {
  const email = (session?.user?.email ?? "").trim()
  const name = (session?.user?.name ?? "").trim() || email.split("@")[0] || "unknown"
  return { email: email || "unknown", name }
}

/**
 * อีเมลของเซลล์เจ้าของดีล — ใช้ผูก "ดีลของฉัน" / คอม
 * 1) ชื่อตรงกับ sales_people ที่ตั้งอีเมลไว้ → ใช้อีเมลนั้น (ใครคีย์ให้ก็ยังเป็นดีลของเซลล์คนนั้น)
 * 2) ชื่อตรงกับคนที่กดบันทึก → อีเมลคนกดบันทึก
 * 3) ไม่รู้จัก → "" (เทียบชื่อสำรองที่ฝั่งลิสต์)
 */
export async function resolveSalesEmail(db: Db, salesName: string, actor: Actor): Promise<string> {
  const name = salesName.trim()
  if (!name) return ""
  const row = await db.collection("sales_people").findOne(
    { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
    { projection: { email: 1 } },
  )
  const email = String(row?.email ?? "").trim()
  if (email) return email
  return name === actor.name ? actor.email : ""
}
