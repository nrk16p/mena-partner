import Link from "next/link"

/**
 * หน้าเว็บสาธารณะ (ขายรถ /trucks) — ไม่มี sidebar, ไม่ต้อง login, light mode คงที่
 * (root layout เปิด dark ตาม localStorage ของพนักงาน — หน้าขายต้องขาวเสมอ จึง override สีเอง)
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900" style={{ colorScheme: "light" }}>
      <header className="border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/trucks" className="font-bold text-lg">มีนา ทรานสปอร์ต · รถมือสอง</Link>
          <Link href="/trucks" className="text-sm font-medium rounded-lg px-4 py-2 bg-zinc-900 text-white">ดูรถทั้งหมด</Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-500">
          <p className="font-semibold text-zinc-700">บริษัท มีนา ทรานสปอร์ต จำกัด</p>
          <p className="mt-1">รถผสมปูน (มิกเซอร์) มือสอง พร้อมงานวิ่ง · ผ่อนกับบริษัทโดยตรง</p>
        </div>
      </footer>
    </div>
  )
}
