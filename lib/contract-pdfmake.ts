/** Registry ของ pdfmake document builders (แยกไฟล์ตามชนิดเอกสาร) */
import "server-only"
import type { Contract } from "@/types"
import type { PromoMasterData } from "@/lib/contract-docx"
import { normPlate } from "@/lib/contract-docx"
import { saleDocDef } from "@/lib/contract-pdfmake-sale"
import { hireDocDef } from "@/lib/contract-pdfmake-hire"
import { guaranteeDocDef } from "@/lib/contract-pdfmake-guarantee"
import { creditorDocDef } from "@/lib/contract-pdfmake-creditor"

/* eslint-disable @typescript-eslint/no-explicit-any */

export const PDFMAKE_DOCS: Record<string, (c: Contract, promo: PromoMasterData | null) => any> = {
  sale: saleDocDef,
  hire: hireDocDef,
  guarantee: guaranteeDocDef,
  creditor: creditorDocDef,
}

export const PDF_FILENAME: Record<string, (c: Contract) => string> = {
  sale: (c) => `สัญญาซื้อขาย-${c.contractCode}-${normPlate(c.licensePlate) || "รถ"}.pdf`,
  hire: (c) => `สัญญาว่าจ้าง-${c.contractCode}-${normPlate(c.licensePlate) || "รถ"}.pdf`,
  guarantee: (c) => `สัญญาค้ำประกัน-${c.contractCode}-${normPlate(c.licensePlate) || "รถ"}.pdf`,
  creditor: (c) => `เปิดรหัสเจ้าหนี้-${c.contractCode}-${normPlate(c.licensePlate) || "รถ"}.pdf`,
}

export type PdfmakeType = keyof typeof PDFMAKE_DOCS
