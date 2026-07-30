/**
 * Golden regression — งวด มิ.ย. 2026 (Rev.o1 Payroll กค.69 · Mixer.rar) 112 คน
 * รันทุกครั้งที่แก้ lib/payroll-engine.ts เพื่อยืนยันว่าเลขไม่เพี้ยน:
 *
 *   ./node_modules/.bin/esbuild scripts/verify-golden.ts --bundle --platform=node --format=cjs \
 *     --outfile=scripts/.verify-golden.cjs --tsconfig=tsconfig.json --packages=external \
 *     --alias:server-only=./scripts/golden/server-only-stub.js
 *   set -a; source .env.local; set +a; node scripts/.verify-golden.cjs
 *
 * เกณฑ์ผ่าน: netBeforeCarry + WHT ตรง 112/112 (±0.02)
 */
import { MongoClient } from "mongodb"
import { readFileSync } from "fs"
import { join } from "path"
import { calculatePayrollEntry } from "../lib/payroll-engine"

const r2 = (n: number) => Math.round(n * 100) / 100

async function main() {
  const EX: Record<string, Record<string, number>> = JSON.parse(
    readFileSync(join(__dirname, "golden", "payroll-2026-06.json"), "utf-8"))
  const client = new MongoClient(process.env.MONGO_URI!)
  await client.connect()
  const db = client.db(process.env.MONGO_DB ?? "mena_partner")

  const CHECKS: [string, (e: Awaited<ReturnType<typeof calculatePayrollEntry>> & object, x: Record<string, number>) => [number, number]][] = [
    ["transportFee",  (e, x) => [e.transportFee, x.transportFee]],
    ["totalIncome",   (e, x) => [e.totalIncome, x.totalIncome]],
    ["fuelNet",       (e, x) => [r2(e.fuel + e.fuelOverCharge - e.fuelUnderRefund), x.fuel]],
    ["wht3pct",       (e, x) => [e.whtAmount, x.wht]],
    ["netBeforeCarry", (e, x) => [e.netPay, r2(x.balance + x.carryIn)]],
  ]
  const stat: Record<string, { ok: number; off: string[] }> = {}
  for (const [nm] of CHECKS) stat[nm] = { ok: 0, off: [] }

  for (const [code, x] of Object.entries(EX)) {
    const e = await calculatePayrollEntry(db, code, "2026-06")
    if (!e) { CHECKS.forEach(([nm]) => stat[nm].off.push(`${code}(no-entry)`)); continue }
    for (const [nm, fn] of CHECKS) {
      const [vs, vf] = fn(e, x)
      if (Math.abs(r2(vs - vf)) <= 0.02) stat[nm].ok++
      else stat[nm].off.push(`${code} ${r2(vs)}≠${r2(vf)}`)
    }
  }
  let fail = false
  for (const [nm, s] of Object.entries(stat)) {
    const pass = s.off.length === 0
    if ((nm === "netBeforeCarry" || nm === "wht3pct") && !pass) fail = true
    console.log(`${pass ? "✅" : "❌"} ${nm}: ${s.ok}/112`, s.off.slice(0, 5).join(" · "))
  }
  await client.close()
  if (fail) { console.error("GOLDEN FAILED — engine เพี้ยนจากไฟล์จริง ห้าม deploy"); process.exit(1) }
  console.log("GOLDEN PASSED ✓")
}
main().catch((e) => { console.error(e); process.exit(1) })
