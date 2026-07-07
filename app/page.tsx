import Link from "next/link"
import {
  Users, Truck, FileText, Warehouse, ClipboardList, CalendarCheck,
  Tag, ShieldCheck, Wrench, ArrowRight, BookOpen, AlertTriangle,
  CheckCircle2, Upload, Banknote,
} from "lucide-react"

/**
 * หน้าหลัก — สรุป flow การทำงานของทีม + คู่มือประกอบต่อโมดูล
 * เนื้อหาอิง docs/PLATFORM-ROADMAP.md (ปรับปรุงเมื่อกติกาเปลี่ยน)
 */

const FLOW = [
  {
    no: "1",
    icon: <Users className="w-4 h-4" />,
    title: "ข้อมูลหลัก",
    desc: "คนขับ (บัตร ปชช./วันเกิด/ที่อยู่/บัญชี) · รถ (ยี่ห้อ รุ่น เลขตัวถัง เลขเครื่อง) · ราคาขาย",
    links: [
      { href: "/drivers", label: "พนักงานขับรถ" },
      { href: "/vehicles", label: "ทะเบียนรถ" },
      { href: "/price-list", label: "ราคาขาย" },
    ],
  },
  {
    no: "2",
    icon: <FileText className="w-4 h-4" />,
    title: "ทำสัญญา",
    desc: "สร้างสัญญา (auto-fill จากข้อมูลหลัก) → เช็ค checklist เขียว → พิมพ์สัญญา PDF ให้เซ็น → ตั้งโปรโมชั่น",
    links: [
      { href: "/contracts/new", label: "สร้างสัญญาใหม่" },
      { href: "/contracts", label: "สัญญาทั้งหมด" },
    ],
  },
  {
    no: "3",
    icon: <Warehouse className="w-4 h-4" />,
    title: "งานประจำวัน",
    desc: "นำเข้าเที่ยววิ่ง + รายการเบิกอะไหล่ · บันทึกใบรับสภาพหนี้ · จับคู่ MR แล้วติ๊กหักโปรซ่อม/PM1/PM2",
    links: [
      { href: "/trips", label: "เที่ยววิ่ง" },
      { href: "/vehicle-cost?tab=merged", label: "จับคู่หักโปรฯ" },
      { href: "/import", label: "นำเข้า Excel" },
    ],
  },
  {
    no: "4",
    icon: <Banknote className="w-4 h-4" />,
    title: "รอบเงินเดือน",
    desc: "ระบบรวมรายได้เที่ยว − รายการหักทั้งหมด (ค่างวด/ดาวน์/ภาษี-ประกัน/GPS/น้ำมัน/รับสภาพหนี้) → ตรวจสลิป",
    links: [
      { href: "/payroll", label: "เงินเดือน" },
      { href: "/promotions", label: "โปรโมชั่น" },
    ],
  },
  {
    no: "5",
    icon: <CalendarCheck className="w-4 h-4" />,
    title: "ปิดเดือน & รายงาน",
    desc: "อนุมัติ → พิมพ์สลิปทั้งชุด → ปิดรอบเดือน → ดูรายงานประจำปี",
    links: [
      { href: "/admin/month", label: "จัดการรอบเดือน" },
      { href: "/reports", label: "รายงาน" },
    ],
  },
]

const GUIDES: {
  icon: React.ReactNode
  title: string
  href: string
  steps: string[]
}[] = [
  {
    icon: <FileText className="w-3.5 h-3.5" />,
    title: "สัญญา + พิมพ์ PDF",
    href: "/contracts",
    steps: [
      "สร้างสัญญา: เลือกคนขับ + รถ → ราคา/งวด ดึงจาก price-list อัตโนมัติ",
      "แถบเหลืองบอกช่องที่ยังขาด — ทุกข้อมูลในสัญญาจำเป็นต้องกรอก (ช่องที่ขาดไฮไลต์เหลือง)",
      "ครึ่งขวาของหน้าแก้ไขคือ preview สัญญาสด — พิมพ์แล้วเห็นทันที",
      "กด “เอกสารสัญญา (PDF)” → พิมพ์/Save as PDF (ปิด Headers/Footers) ได้ 6 หน้า A4 ฟอนต์ Cordia ตามต้นฉบับ",
    ],
  },
  {
    icon: <Tag className="w-3.5 h-3.5" />,
    title: "โปรโมชั่น (โปร 1/2/3)",
    href: "/promotions",
    steps: [
      "หน้ารวม: เห็นงบซ่อม/PM ที่ใช้ไปต่อคัน (เลขเดียวกับหน้าค่าใช้จ่ายรถ) + ปุ่ม “การใช้สิทธิ์”",
      "กติกาสำคัญ: งบจะถูกตัด เฉพาะเมื่อทีมระบุ — ติ๊กจากรายการเบิก หรือกด “ยืนยันตัดงบ”",
      "ประวัติจาก Excel ที่ยังไม่ยืนยัน = ป้ายเหลือง “รอยืนยัน” (ยังไม่หักวงเงิน)",
      "โปร 3 (PM): เพดานรีเซ็ตทุก 1 ม.ค. — ป้าย PM1/PM2 ติดจากการติ๊กในคลังหรือบันทึกมือ",
    ],
  },
  {
    icon: <Wrench className="w-3.5 h-3.5" />,
    title: "ค่าใช้จ่ายรถ (4 แท็บ)",
    href: "/vehicle-cost",
    steps: [
      "ค่าใช้จ่าย: บันทึกรายจ่ายทั่วไปต่อสัญญา (ไม่หักโปรฯ)",
      "รับสภาพหนี้: ใบรับผิดของ พจร. พร้อมงวดผ่อน",
      "การเบิก: รายการอะไหล่จากคลัง (นำเข้า Excel)",
      "จับคู่: เปิดใบรับสภาพหนี้ → เทียบรายการเบิกตามเลข MR → ติ๊ก [โปรซ่อม][PM1][PM2] → บันทึก = ตัดงบจริง + พิมพ์ใบเสร็จ",
    ],
  },
  {
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    title: "เที่ยววิ่ง → เงินเดือน",
    href: "/payroll",
    steps: [
      "นำเข้าเที่ยววิ่งรายเดือน (ผูก contractCode อัตโนมัติ)",
      "หน้าเงินเดือนคำนวณ: รายได้เที่ยว + OT − รายการหักทุกประเภท",
      "ตรวจสลิปรายคน → แก้ที่ต้นทางถ้าผิด → รันใหม่",
      "พิมพ์สลิปรายใบ หรือทั้งชุด (print-all)",
    ],
  },
  {
    icon: <Users className="w-3.5 h-3.5" />,
    title: "ข้อมูลหลัก (Master Data)",
    href: "/drivers",
    steps: [
      "คนขับ: กรอก บัตร ปชช. / วันเกิด / ที่อยู่ ให้ครบ — จำเป็นต่อสัญญา PDF",
      "รถ: กรอกสเปคจากเล่มทะเบียน (ยี่ห้อ รุ่น เลขตัวถัง เลขเครื่อง สี วันจด)",
      "ราคาขาย: ดาวน์/งวด/ไฟแนนซ์ ต่อทะเบียน — สัญญาใหม่ดึงจากตรงนี้",
    ],
  },
  {
    icon: <Upload className="w-3.5 h-3.5" />,
    title: "นำเข้าข้อมูล (Excel)",
    href: "/import",
    steps: [
      "รายการเบิกคลัง (stock movement): อัปโหลด → ตรวจ preview → ยืนยัน (กันซ้ำอัตโนมัติ)",
      "รับสภาพหนี้ / เที่ยววิ่ง: ทำแบบเดียวกันในเมนูของแต่ละหน้า",
      "นำเข้าซ้ำไฟล์เดิมได้ ระบบ upsert ไม่เกิดรายการซ้ำ",
    ],
  },
]

const RULES = [
  { icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />, text: "งบโปรฯ (ซ่อม/PM) ตัดเฉพาะรายการที่ทีมระบุแล้วเท่านั้น — ประวัติเก่าที่ยังไม่ยืนยันไม่หักวงเงิน" },
  { icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />, text: "เลข MR เดียวกันนับครั้งเดียวเสมอ (ใบเคลม Excel กับรายการเบิกคลังไม่ซ้ำกัน)" },
  { icon: <CalendarCheck className="w-3.5 h-3.5 text-purple-400" />, text: "เพดาน PM รีเซ็ตทุก 1 ม.ค. — รายการปีก่อนนับในเพดานปีนั้น / วงเงินซ่อมนับตลอดอายุสัญญา" },
  { icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />, text: "ทุกข้อมูลที่ปรากฏในสัญญาจำเป็นต้องกรอก — ช่องที่ขาดจะพิมพ์เป็นเส้นประให้เติมมือ" },
  { icon: <Truck className="w-3.5 h-3.5 text-zinc-400" />, text: "ทะเบียนรถเก็บแบบมีคำนำหน้า (สบ.71-1959) — ระบบจับคู่ให้อัตโนมัติทุกหน้า" },
]

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      {/* header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">MENA Partner · รถร่วม Mixer</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Flow การทำงาน & คู่มือระบบ</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            ระบบหลักของทีมรถร่วม — สัญญา · ข้อมูลหลัก · เที่ยววิ่ง · โปรโมชั่น · ค่าใช้จ่าย · เงินเดือน
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5">
          <BookOpen className="w-3.5 h-3.5" /> คู่มือฉบับเต็ม: docs/PLATFORM-ROADMAP.md
        </span>
      </div>

      {/* ── flow pipeline ── */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wide">
          Flow หลัก 5 ขั้น
        </h2>
        <div className="grid md:grid-cols-5 gap-3">
          {FLOW.map((s, i) => (
            <div key={s.no} className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">{s.no}</span>
                <span className="text-emerald-600 dark:text-emerald-400">{s.icon}</span>
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{s.title}</p>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 mt-1 flex-1">{s.desc}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {s.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded px-1.5 py-0.5"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              {i < FLOW.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 dark:text-zinc-600 z-10" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── business rules ── */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wide">
          กติกาสำคัญของระบบ
        </h2>
        <ul className="space-y-2">
          {RULES.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-zinc-600 dark:text-zinc-300">
              <span className="mt-0.5 shrink-0">{r.icon}</span>
              {r.text}
            </li>
          ))}
        </ul>
      </section>

      {/* ── per-module guides ── */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wide">
          คู่มือประกอบต่อโมดูล
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {GUIDES.map((g) => (
            <div key={g.title} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  <span className="text-emerald-600 dark:text-emerald-400">{g.icon}</span>
                  {g.title}
                </span>
                <Link href={g.href} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  เปิดหน้า <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <ol className="space-y-1.5">
                {g.steps.map((st, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0 w-3">{i + 1}.</span>
                    {st}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center pb-4">
        MENA Partner Platform · อัปเดตคู่มือนี้ได้ที่ <span className="font-mono">app/page.tsx</span> · แผนพัฒนาระยะยาว: <span className="font-mono">docs/PLATFORM-ROADMAP.md</span>
      </p>
    </div>
  )
}
