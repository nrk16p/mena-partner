import "server-only"
import { ObjectId } from "mongodb"
import type { Db } from "mongodb"
import type { Contract } from "@/types"
import { pageFooter } from "@/lib/contract-pdfmake-helpers"

/* eslint-disable @typescript-eslint/no-explicit-any */

// pdfmake ฝังได้เฉพาะ JPEG / PNG — ชนิดอื่น (เช่น PDF/HEIC) ข้าม (ยังเปิดดูได้จากลิงก์เอกสารแนบ)
const IMG_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"])

/**
 * ต่อ "เอกสารแนบของพนักงานขับรถ" (บัตร ปชช./ใบขับขี่/ทะเบียนบ้าน/ไฟล์แนบอื่น)
 * เป็นหน้าใหม่ท้าย PDF สัญญา — แก้ docDef.content โดยตรง
 */
export async function appendDriverAttachments(db: Db, contract: Contract, docDef: any): Promise<void> {
  // หา driver: driverId ก่อน → contractCode → ทะเบียน
  let driver: any = null
  const driverId = (contract as any).driverId as string | undefined
  if (driverId && ObjectId.isValid(driverId)) {
    driver = await db.collection("drivers").findOne({ _id: new ObjectId(driverId) })
  }
  if (!driver && contract.contractCode) {
    driver = await db.collection("drivers").findOne({ contractCode: contract.contractCode })
  }
  if (!driver) return

  const items: { url: string; label: string }[] = [
    { url: driver.idCardUrl,  label: "สำเนาบัตรประชาชน" },
    { url: driver.licenseUrl, label: "สำเนาใบขับขี่" },
    { url: driver.houseRegUrl, label: "สำเนาทะเบียนบ้าน" },
    ...(Array.isArray(driver.attachments)
      ? driver.attachments.map((u: string, i: number) => ({ url: u, label: `เอกสารแนบเพิ่มเติม ${i + 1}` }))
      : []),
  ].filter((x) => x.url)
  if (items.length === 0) return

  const name = `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() || (contract.buyerName ?? "")

  let appended = 0
  for (const it of items) {
    try {
      const res = await fetch(it.url)
      if (!res.ok) continue
      const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
      if (!IMG_TYPES.has(ct)) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length === 0) continue
      const dataUri = `data:${ct === "image/jpg" ? "image/jpeg" : ct};base64,${buf.toString("base64")}`
      docDef.content.push(
        {
          text: `เอกสารแนบ: ${it.label}${name ? ` — ${name}` : ""}`,
          bold: true,
          fontSize: 16,
          pageBreak: "before",
          margin: [0, 0, 0, 12],
        },
        // A4 content ~ 493 x 760pt (หัก margin + heading) — fit ให้พอดีหน้า ไม่ล้น
        { image: dataUri, fit: [490, 680], alignment: "center" },
      )
      appended++
    } catch {
      // ดึงรูปไม่ได้ → ข้าม ไม่ให้ PDF ทั้งฉบับพัง
    }
  }

  // ถ้ายังไม่มี footer (บางชนิด) ให้ใส่ footer เลขที่สัญญา (sale มีอยู่แล้ว)
  if (appended > 0 && !docDef.footer) {
    docDef.footer = pageFooter(contract.contractCode ?? "")
  }
}
