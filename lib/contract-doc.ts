import type { Contract } from "@/types"

/**
 * Fields required for a complete printed sale contract
 * (สัญญาซื้อขายรถยนต์บรรทุก PDF) — shared by the document page and the
 * contract edit page so both report the same completeness.
 */
export interface DocField {
  key: keyof Contract
  label: string
}

export const DOC_REQUIRED: DocField[] = [
  { key: "contractDate",            label: "วันที่ทำสัญญา" },
  { key: "buyerName",               label: "ชื่อผู้ซื้อ" },
  { key: "birthDate",               label: "วันเกิดผู้ซื้อ (อายุ)" },
  { key: "nationalId",              label: "เลขบัตรประชาชน" },
  { key: "driverAddress",           label: "ที่อยู่ผู้ซื้อ" },
  { key: "vehicleType",             label: "ประเภทรถ" },
  { key: "vehicleCharacteristic",   label: "ลักษณะ/มาตรฐาน" },
  { key: "vehicleBrand",            label: "ยี่ห้อ" },
  { key: "vehicleModel",            label: "รุ่น" },
  { key: "vehicleRegistrationDate", label: "วันจดทะเบียน" },
  { key: "vehicleColor",            label: "สีรถ" },
  { key: "licensePlate",            label: "เลขทะเบียน" },
  { key: "chassisNumber",           label: "หมายเลขตัวรถ" },
  { key: "engineNumber",            label: "หมายเลขเครื่องยนต์" },
  { key: "engineSize",              label: "ขนาดกำลังเครื่องยนต์" },
  { key: "mileage",                 label: "ระยะทางที่ใช้แล้ว (กม.)" },
  { key: "totalPrice",              label: "ราคาซื้อขาย" },
  { key: "downPayment",             label: "เงินดาวน์รวม" },
  { key: "cashDown",                label: "เงินดาวน์ชำระแล้ว" },
  { key: "remainingInstallment",    label: "เงินดาวน์คงเหลือ" },
  { key: "downInstallmentAmt",      label: "ค่างวดดาวน์" },
  { key: "downInstallmentCount",    label: "จำนวนงวดดาวน์" },
  { key: "financeAmount",           label: "ยอดเงินค่างวด" },
  { key: "monthlyInstallment",      label: "ค่างวดรายเดือน" },
  { key: "totalInstallments",       label: "จำนวนงวดรวม" },
]

/** Fields still missing for the printed contract (0/empty count as missing). */
export function missingDocFields(c: Partial<Contract> | null | undefined): DocField[] {
  if (!c) return DOC_REQUIRED
  return DOC_REQUIRED.filter(({ key }) => {
    // เงินดาวน์คงเหลือ derive ได้จาก ดาวน์รวม - ชำระแล้ว
    if (key === "remainingInstallment") {
      const derivable = c.downPayment != null && c.downPayment !== 0 && c.cashDown != null && c.cashDown !== 0
      return !c.remainingInstallment && !derivable
    }
    const v = c[key]
    return v === undefined || v === null || v === "" || v === 0
  })
}
