"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { confirm, prompt } from "@/components/ui/confirm"
import { UserPlus, ArrowLeft, Check, X, RotateCcw, ExternalLink, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BROKER_STATUS_LABEL, centerLabel, type BrokerStatus } from "@/lib/broker-application"

interface Application {
  _id: string
  firstName: string
  lastName: string
  nationalId: string
  address: string
  phone: string
  lineId: string
  position: string
  company: string
  bankAccountNo: string
  bankName: string
  bankAccountName: string
  center: string
  centerOther: string
  status: BrokerStatus
  duplicateOf: string
  reviewNote?: string
  reviewedBy?: string
  createdAt: string
  timeline?: { at: string; by: string; action: string }[]
}

const TABS: { key: BrokerStatus | ""; label: string }[] = [
  { key: "pending", label: "รอตรวจ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ไม่อนุมัติ" },
  { key: "", label: "ทั้งหมด" },
]

const STATUS_CLS: Record<BrokerStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
}

const thDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
const fmtNid = (v: string) => v.replace(/^(\d)(\d{4})(\d{5})(\d{2})(\d)$/, "$1-$2-$3-$4-$5")

export default function BrokerApplicationsPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = role === "admin" || role === "superadmin"

  const [tab, setTab] = useState<BrokerStatus | "">("pending")
  const [rows, setRows] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState("")
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    if (!isAdmin) return
    let live = true
    fetch(`/api/quotations/brokers?status=${tab}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Application[]) => { if (live) { setRows(d); setLoading(false) } })
    return () => { live = false }
  }, [isAdmin, tab, reloadKey])

  async function review(a: Application, status: BrokerStatus) {
    const name = `${a.firstName} ${a.lastName}`
    let note = ""
    if (status === "rejected") {
      const r = await prompt({ title: `ไม่อนุมัติ ${name}`, description: "เหตุผล (ผู้สมัครจะไม่เห็นข้อความนี้ ใช้คุยกันในทีม)", placeholder: "เช่น เลขบัญชีไม่ตรงชื่อ" })
      if (!r?.trim()) return
      note = r.trim()
    } else if (status === "approved") {
      const ok = await confirm({ title: `อนุมัติ ${name}?`, description: "ชื่อนี้จะเข้าไปอยู่ในทีมขาย เลือกเป็นผู้ขายในใบเสนอราคาได้ และยอดค่าคอมจะนับให้คนนี้" })
      if (!ok) return
    }
    setBusy(true); setErr(""); setMsg("")
    try {
      const r = await fetch("/api/quotations/brokers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: a._id, status, note }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error ?? "บันทึกไม่สำเร็จ"); return }
      setMsg(status === "approved"
        ? `อนุมัติ ${name} แล้ว${d.addedToSales ? " และเพิ่มเข้าทีมขายแล้ว" : " (มีชื่อในทีมขายอยู่แล้ว)"}`
        : status === "rejected" ? `ไม่อนุมัติ ${name}` : `ย้าย ${name} กลับไปรอตรวจ`)
      setOpenId("")
      setReloadKey((k) => k + 1)
    } finally { setBusy(false) }
  }

  if (!isAdmin) {
    return <div className="max-w-2xl mx-auto py-16 text-center text-sm text-zinc-400">หน้านี้สำหรับแอดมินเท่านั้น</div>
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">ระบบขาย</p>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserPlus className="w-6 h-6 text-[#C9A227]" /> ใบสมัครนายหน้า</h1>
          <p className="text-xs text-zinc-400 mt-0.5">ใบสมัครที่ส่งมาจากหน้าเว็บ — อนุมัติแล้วชื่อจะเข้าทีมขายให้เลือกในใบเสนอราคา</p>
        </div>
        <div className="flex gap-2">
          <a href="/sales-partner" target="_blank" className="flex items-center gap-1.5 text-sm border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <ExternalLink className="w-4 h-4" /> หน้าสมัคร
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/sales-partner`).then(() => setMsg("คัดลอกลิงก์หน้าสมัครแล้ว ส่งต่อในไลน์ได้เลย"))}
            className="flex items-center gap-1.5 text-sm border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <Copy className="w-4 h-4" /> คัดลอกลิงก์
          </button>
          <Link href="/quotations" className="flex items-center gap-1.5 text-sm border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <ArrowLeft className="w-4 h-4" /> กลับหน้าขาย
          </Link>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key} type="button" onClick={() => { if (t.key !== tab) { setLoading(true); setTab(t.key) } setOpenId("") }}
            className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === t.key ? "border-emerald-600 font-semibold text-emerald-700 dark:text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-14 text-center text-sm text-zinc-400">
          {tab === "pending" ? "ไม่มีใบสมัครรอตรวจ" : "ยังไม่มีใบสมัครในแท็บนี้"}
        </div>
      ) : (
        <ul className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((a) => {
            const open = openId === a._id
            return (
              <li key={a._id}>
                <button type="button" onClick={() => setOpenId(open ? "" : a._id)} aria-expanded={open}
                  className="w-full px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <span className="font-semibold min-w-[160px]">{a.firstName} {a.lastName}</span>
                  <span className="text-sm text-zinc-500 tabular-nums">{a.phone}</span>
                  <span className="text-sm text-zinc-500">{centerLabel(a.center, a.centerOther)}</span>
                  {a.duplicateOf && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">เลขบัตรนี้เคยสมัครแล้ว</span>}
                  <span className="ml-auto text-xs text-zinc-400">{thDate(a.createdAt)}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLS[a.status]}`}>{BROKER_STATUS_LABEL[a.status]}</span>
                </button>

                {open && (
                  <div className="px-4 pb-4 grid gap-4 md:grid-cols-[1fr_auto]">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-zinc-400">เลขบัตรประชาชน</dt><dd className="tabular-nums">{fmtNid(a.nationalId)}</dd>
                      <dt className="text-zinc-400">ที่อยู่ตามบัตร</dt><dd>{a.address}</dd>
                      <dt className="text-zinc-400">LINE ID</dt><dd>{a.lineId || "—"}</dd>
                      <dt className="text-zinc-400">ตำแหน่ง / บริษัท</dt><dd>{[a.position, a.company].filter(Boolean).join(" · ") || "—"}</dd>
                      <dt className="text-zinc-400">บัญชีรับเงิน</dt>
                      <dd>{a.bankName} · <span className="tabular-nums">{a.bankAccountNo}</span> · {a.bankAccountName}
                        {a.bankAccountName.replace(/\s/g, "") !== `${a.firstName}${a.lastName}`.replace(/\s/g, "") && (
                          <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">ชื่อบัญชีไม่ตรงชื่อผู้สมัคร</span>
                        )}
                      </dd>
                      {a.reviewNote && <><dt className="text-zinc-400">หมายเหตุ</dt><dd>{a.reviewNote}</dd></>}
                      {a.timeline?.map((t, i) => (
                        <div key={i} className="contents text-xs"><dt className="text-zinc-400">{thDate(t.at)}</dt><dd className="text-zinc-500">{t.action} · {t.by}</dd></div>
                      ))}
                    </dl>
                    <div className="flex md:flex-col gap-2 md:min-w-[150px]">
                      {a.status !== "approved" && (
                        <Button disabled={busy} onClick={() => review(a, "approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Check className="w-4 h-4 mr-1" /> อนุมัติ
                        </Button>
                      )}
                      {a.status !== "rejected" && (
                        <Button disabled={busy} variant="outline" onClick={() => review(a, "rejected")}>
                          <X className="w-4 h-4 mr-1" /> ไม่อนุมัติ
                        </Button>
                      )}
                      {a.status !== "pending" && (
                        <Button disabled={busy} variant="ghost" onClick={() => review(a, "pending")}>
                          <RotateCcw className="w-4 h-4 mr-1" /> กลับไปรอตรวจ
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
