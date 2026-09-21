#!/usr/bin/env node
/**
 * bake-photo-rotation.mjs — รูปรถที่มี EXIF orientation ≠ 1 (ถ่ายมือถือแล้วหมุน) → หมุนจริงลงพิกเซล
 * อัปโหลดสำเนาใหม่ขึ้น DO Spaces (mena-partner/vehicles/photos) แล้วชี้ vehicle_master ไปไฟล์ใหม่
 * เหตุผล: next/image + OG หมุนตาม EXIF ให้อยู่แล้ว แต่ export/พิมพ์/บางเครื่องมือไม่หมุน — bake ไว้ชัวร์กว่า
 *   node scripts/bake-photo-rotation.mjs            # dry-run เฉพาะรถพร้อมขาย
 *   node scripts/bake-photo-rotation.mjs --apply    # อัปโหลด + เขียน DB
 *   --all  ทั้งกอง (ไม่ใช่แค่รถพร้อมขาย)
 */
import { MongoClient } from "mongodb"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
for (const f of [".env.local", ".env"]) {
  try { for (const line of readFileSync(resolve(ROOT, f), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  } } catch { /* skip */ }
}
const APPLY = process.argv.includes("--apply"), ALL = process.argv.includes("--all")
const normPlate = (p) => String(p ?? "").replace(/^[^0-9]*/, "").trim()
const enc = (u) => { const i = u.lastIndexOf("/"); return u.slice(0, i + 1) + encodeURIComponent(decodeURIComponent(u.slice(i + 1))) }
const SIDES = ["front", "back", "left", "right", "cabin"]

const bucket = process.env.DO_SPACES_BUCKET, region = process.env.DO_SPACES_REGION ?? "sgp1", folder = process.env.DO_SPACES_FOLDER ?? "mena-partner"
const s3 = new S3Client({ region, endpoint: process.env.DO_SPACES_ENDPOINT, credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET } })

const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
await client.connect()
const db = client.db(process.env.MONGO_DB ?? "mena_partner")
try {
  const [vehicles, prices, contracts] = await Promise.all([
    db.collection("vehicle_master").find({}, { projection: { licensePlate: 1, truckNumber: 1, status: 1, photoUrl: 1, photos: 1 } }).toArray(),
    db.collection("master_price_list").find({}, { projection: { licensePlate: 1, saleStatus: 1 } }).toArray(),
    db.collection("contracts").find({ status: "active" }, { projection: { licensePlate: 1 } }).toArray(),
  ])
  const priceBy = new Map(prices.map((p) => [normPlate(p.licensePlate), p]))
  const underContract = new Set(contracts.map((c) => normPlate(c.licensePlate)))
  const isReady = (v) => { const k = normPlate(v.licensePlate); return v.status !== "inactive" && !underContract.has(k) && priceBy.get(k)?.saleStatus === "ready" }
  const targets = ALL ? vehicles : vehicles.filter(isReady)
  console.log(`โหมด ${APPLY ? "APPLY" : "DRY-RUN"} · ตรวจ ${targets.length} คัน`)

  let checked = 0, rotated = 0, unreadable = 0
  for (const v of targets) {
    const $set = {}
    for (const s of SIDES) {
      const u = v.photos?.[s]; if (!u) continue
      checked++
      let buf, meta
      try { const r = await fetch(enc(u)); if (!r.ok) throw new Error("HTTP " + r.status); buf = Buffer.from(await r.arrayBuffer()); meta = await sharp(buf).metadata() }
      catch (e) { unreadable++; console.log(`  ✗ ${v.truckNumber} ${s}: ${e.message} ${u.slice(-50)}`); continue }
      if (!meta.orientation || meta.orientation === 1) continue
      rotated++
      console.log(`  ↻ ${v.truckNumber} ${s.padEnd(6)} orient ${meta.orientation} ${meta.width}x${meta.height}`)
      if (!APPLY) continue
      const out = await sharp(buf).rotate().jpeg({ quality: 85 }).toBuffer()
      const key = `${folder}/vehicles/photos/${Date.now()}_${normPlate(v.licensePlate).replace(/[^0-9a-z]/gi, "")}_${s}.jpg`
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: out, ContentType: "image/jpeg", ACL: "public-read" }))
      const url = `https://${bucket}.${region}.digitaloceanspaces.com/${key}`
      $set[`photos.${s}`] = url
      if (v.photoUrl === u || (s === "front" && !v.photoUrl)) $set.photoUrl = url
    }
    if (APPLY && Object.keys($set).length) {
      $set.updatedAt = new Date()
      await db.collection("vehicle_master").updateOne({ _id: v._id }, { $set })
    }
  }
  console.log(`\nตรวจ ${checked} รูป · ต้องหมุน ${rotated} · อ่านไม่ได้ ${unreadable}${APPLY ? " · อัปโหลด+เขียน DB แล้ว" : ""}`)
} finally { await client.close() }
