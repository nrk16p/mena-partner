/**
 * ดึงรูปรถ 5 ด้านจาก Trainer App (mena-safety-ncac) ตรงจาก S3 — 2026-11-13
 *
 * แหล่งข้อมูล
 *   - งานตรวจ: api-ncac GET /inspection/task/ → /inspection/task/{id} (drivers: ทะเบียน, ชื่อ, วันที่ตรวจ)
 *   - รูป: DO Spaces bucket เดียวกัน (mn-bucket) ที่ trainer-app/{taskId}/{ชื่อ นามสกุล}/vehicle_{side}_photo.{ext}
 *     ไฟล์เป็น private (ลิงก์ตรง 403) → copy ไป mena-partner/trainer/{ทะเบียน}/ แบบ public-read
 *     แล้วเก็บลิงก์ public ลง vehicle_master.photos ใช้ได้ทุกที่ (/trucks, โปสเตอร์, Catalog PDF, OG)
 *
 * นโยบายทับรูป: ทับรูปอัตโนมัติ (รายงานรถสะอาด / trainer รอบก่อน) และช่องว่าง
 *   **ไม่ทับรูปที่ทีมอัปเองจากฟอร์มรถ** (ลิงก์อยู่ใต้ mena-partner/vehicles/)
 * รถหลายรอบตรวจในเดือนเดียว → ใช้รอบล่าสุด (inspection_date)
 */
import { S3Client, ListObjectsV2Command, CopyObjectCommand } from "@aws-sdk/client-s3"
import type { Db } from "mongodb"

const API = process.env.API_NCAC_URL ?? "https://api-ncac.onrender.com"
const SRC_PREFIX = "trainer-app"
const SIDE_FROM_FILE: Record<string, Side> = {
  vehicle_front_photo: "front", vehicle_left_photo: "left", vehicle_right_photo: "right",
  vehicle_rear_photo: "back", vehicle_inside_photo: "cabin",
}
const SIDES = ["front", "left", "right", "back", "cabin"] as const
type Side = typeof SIDES[number]

export interface TrainerInspection {
  taskId: string
  plate: string
  driverId: string
  name: string
  inspectedAt: string
}
export interface TrainerPhotoPlan {
  plate: string
  taskId: string
  inspectedAt: string
  sides: Partial<Record<Side, string>>   // side → source key
  replace: Side[]                        // ด้านที่จะเขียนจริง (หลังกันรูปที่ทีมอัปเอง)
  keptManual: Side[]
  setPhotoUrl: boolean
}
export interface TrainerSyncResult {
  months: string[]
  inspections: number
  platesInPriceList: number
  withPhotos: number
  noPhotoFolder: string[]
  plans: TrainerPhotoPlan[]
  written?: number
  copied?: number
  errors?: string[]
}

let s3c: S3Client | null = null
function s3(): S3Client {
  if (s3c) return s3c
  const endpoint = process.env.DO_SPACES_ENDPOINT, key = process.env.DO_SPACES_KEY, secret = process.env.DO_SPACES_SECRET
  if (!endpoint || !key || !secret) throw new Error("Missing DO_SPACES_ENDPOINT / DO_SPACES_KEY / DO_SPACES_SECRET")
  s3c = new S3Client({ region: process.env.DO_SPACES_REGION ?? "sgp1", endpoint, credentials: { accessKeyId: key, secretAccessKey: secret } })
  return s3c
}
const bucket = () => process.env.DO_SPACES_BUCKET ?? "mn-bucket"
const region = () => process.env.DO_SPACES_REGION ?? "sgp1"
const folder = () => process.env.DO_SPACES_FOLDER ?? "mena-partner"
const publicUrl = (key: string) =>
  `https://${bucket()}.${region()}.digitaloceanspaces.com/${key.split("/").map(encodeURIComponent).join("/")}`

/** รูปที่ทีมอัปเองจากฟอร์มรถ — ห้ามทับ */
export const isManualPhoto = (url: unknown) => typeof url === "string" && /\/mena-partner\/vehicles\//.test(decodeURI(url))

const normPlate = (p: string) => p.replace(/\s+/g, "").trim()
const monthOf = (t: Record<string, unknown>) => String(t.action_date ?? t.plan_date ?? "").slice(0, 7)

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(60_000), cache: "no-store" })
  if (!res.ok) throw new Error(`api-ncac ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

/** ทำงานทีละ n ชิ้น — ไม่ยิง api-ncac / S3 รัว */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

/** เดือนล่าสุดที่มีงานตรวจ + เดือนก่อนหน้า (ไว้เติมคันที่เดือนล่าสุดไม่ได้ตรวจ) */
export async function loadInspections(months?: string[]): Promise<{ months: string[]; rows: TrainerInspection[] }> {
  const tasks = await getJson<Record<string, unknown>[]>("/inspection/task/")
  const all = [...new Set(tasks.map(monthOf).filter(Boolean))].sort()
  const use = months?.length ? months : all.slice(-2)
  const ids = tasks.filter((t) => use.includes(monthOf(t))).map((t) => String(t.inspection_task_id))
  const details = await pool(ids, 4, (id) =>
    getJson<{ drivers?: Record<string, unknown>[] }>(`/inspection/task/${encodeURIComponent(id)}`).catch(() => ({ drivers: [] })))
  const rows: TrainerInspection[] = []
  details.forEach((d, k) => {
    for (const x of d.drivers ?? []) {
      const plate = normPlate(String(x.number_plate ?? ""))
      if (!plate) continue
      rows.push({
        taskId: ids[k], plate, driverId: String(x.driver_id ?? ""),
        name: `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim(),
        inspectedAt: String(x.inspection_date ?? ""),
      })
    }
  })
  return { months: use, rows }
}

/** ไฟล์รูปรถของคนขับในงานนั้น (โฟลเดอร์ = ชื่อ นามสกุล หรือ driver_id ถ้าตอนถ่ายยังไม่รู้ชื่อ) */
async function listSides(r: TrainerInspection): Promise<Partial<Record<Side, string>>> {
  for (const f of [r.name, r.driverId].filter(Boolean)) {
    const res = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: `${SRC_PREFIX}/${r.taskId}/${f}/` }))
    const sides: Partial<Record<Side, string>> = {}
    for (const o of res.Contents ?? []) {
      const base = (o.Key ?? "").split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
      const side = SIDE_FROM_FILE[base]
      if (side && (o.Size ?? 0) > 0) sides[side] = o.Key!
    }
    if (Object.keys(sides).length) return sides
  }
  return {}
}

/** วางแผน (ไม่เขียนอะไร) — ใช้ทั้ง dry-run และก่อนเขียนจริง */
export async function planTrainerPhotos(db: Db, months?: string[]): Promise<TrainerSyncResult> {
  const { months: used, rows } = await loadInspections(months)
  const priced = new Set((await db.collection("master_price_list").find({}, { projection: { licensePlate: 1 } }).toArray())
    .map((p) => normPlate(String(p.licensePlate ?? ""))))
  const vehicles = await db.collection("vehicle_master")
    .find({ licensePlate: { $in: [...priced] } }, { projection: { licensePlate: 1, photos: 1, photoUrl: 1, photosTaskId: 1 } }).toArray()
  const vByPlate = new Map(vehicles.map((v) => [normPlate(String(v.licensePlate ?? "")), v]))

  // ต่อทะเบียน: เรียงรอบล่าสุดก่อน — รอบล่าสุดไม่มีรูปค่อยถอยไปรอบก่อน
  const byPlate = new Map<string, TrainerInspection[]>()
  for (const r of rows) if (vByPlate.has(r.plate)) byPlate.set(r.plate, [...(byPlate.get(r.plate) ?? []), r])
  for (const list of byPlate.values()) list.sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))

  const noPhotoFolder: string[] = []
  const plansAll = (await pool([...byPlate.entries()], 6, async ([plate, list]) => {
    for (const r of list) {
      const sides = await listSides(r)
      if (!Object.keys(sides).length) continue
      const v = vByPlate.get(plate)!
      const cur = (v.photos ?? {}) as Record<string, string>
      // รอบตรวจเดิมที่ดึงไปแล้ว + ลิงก์ยังเป็นของรอบนั้น → ข้าม (cron รันทุกวันไม่ต้อง copy ซ้ำ)
      const already = (s: Side) => v.photosTaskId === r.taskId && String(cur[s] ?? "").includes(`/trainer/`)
      const replace = SIDES.filter((s) => sides[s] && !isManualPhoto(cur[s]) && !already(s))
      const keptManual = SIDES.filter((s) => sides[s] && isManualPhoto(cur[s]))
      return {
        plate: String(v.licensePlate), taskId: r.taskId, inspectedAt: r.inspectedAt, sides, replace, keptManual,
        setPhotoUrl: !isManualPhoto(v.photoUrl) && !!(sides.front || sides.left) && !(v.photosTaskId === r.taskId),
      } satisfies TrainerPhotoPlan
    }
    noPhotoFolder.push(plate)
    return null
  })).filter((p): p is TrainerPhotoPlan => !!p)
  const plans = plansAll.filter((p) => p.replace.length > 0)

  return {
    months: used, inspections: rows.length, platesInPriceList: byPlate.size,
    withPhotos: plansAll.length, noPhotoFolder: noPhotoFolder.sort(), plans,
  }
}

/** เขียนจริง: copy รูปเป็น public แล้วอัปเดต vehicle_master */
export async function applyTrainerPhotos(db: Db, plan: TrainerSyncResult, editedBy: string): Promise<TrainerSyncResult> {
  const errors: string[] = []
  let copied = 0, written = 0
  const col = db.collection("vehicle_master")
  await pool(plan.plans, 4, async (p) => {
    try {
      const set: Record<string, unknown> = {}
      for (const side of p.replace) {
        const src = p.sides[side]!
        const ext = src.match(/\.[^.\/]+$/)?.[0] ?? ".jpg"
        const dest = `${folder()}/trainer/${p.plate}/${p.taskId}_${side}${ext}`
        await s3().send(new CopyObjectCommand({
          Bucket: bucket(), Key: dest, ACL: "public-read", MetadataDirective: "COPY",
          CopySource: `${bucket()}/${src.split("/").map(encodeURIComponent).join("/")}`,
        }))
        copied++
        set[`photos.${side}`] = publicUrl(dest)
      }
      if (p.setPhotoUrl) set.photoUrl = set["photos.front"] ?? set["photos.left"]
      if (!Object.keys(set).length) return
      await col.updateOne({ licensePlate: p.plate }, {
        $set: {
          ...set, photosSource: "trainer-app", photosTakenAt: p.inspectedAt, photosTaskId: p.taskId,
          updatedAt: new Date().toISOString(), updatedBy: editedBy,
        },
        $unset: { deadPhotos: "" },
      })
      written++
    } catch (e) {
      errors.push(`${p.plate}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })
  return { ...plan, copied, written, errors }
}
