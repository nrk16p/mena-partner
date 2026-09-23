import type { PublicTruck } from "@/lib/public-trucks"

export function TruckSpecTable({ truck }: { truck: PublicTruck }) {
  const y = truck.registrationYear
  const rows: [string, string][] = [
    ["ยี่ห้อ", truck.brand],
    ["รุ่น", truck.model],
    ["ปีจดทะเบียน", y ? `${y} (${y + 543})` : "—"],
    ["ประเภทรถ", truck.vehicleType],
    ["ลักษณะ", truck.characteristic],
    ["สี", truck.color],
    ["ขนาดเครื่องยนต์", truck.engineSize],
    ["เบอร์รถ", truck.truckNumber],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-zinc-500">{k}</dt>
          <dd className="font-medium text-right sm:text-left">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  )
}
