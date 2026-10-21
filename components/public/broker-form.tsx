"use client"

import { useState } from "react"
import { BROKER_CENTERS, THAI_BANKS, isThaiNationalId } from "@/lib/broker-application"
import { telHref } from "./thai-text"

/** ฟอร์มสมัครนายหน้า — ช่องตามใบกระดาษข้อ 1–3 และ 6 + ชื่อบัญชี + ยินยอม PDPA · ส่งเข้า /api/public/broker-applications */
export function BrokerForm({ phone }: { phone?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState("")
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [accName, setAccName] = useState("")
  const [accNameTouched, setAccNameTouched] = useState(false)
  const [nid, setNid] = useState("")
  const [center, setCenter] = useState("")
  const [bank, setBank] = useState("")

  // ชื่อบัญชีส่วนใหญ่ = ชื่อผู้สมัคร → เติมให้จนกว่าจะพิมพ์เอง
  const shownAccName = accNameTouched ? accName : `${first} ${last}`.trim()
  const nidDigits = nid.replace(/\D/g, "")
  const nidBad = nidDigits.length === 13 && !isThaiNationalId(nidDigits)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setState("sending"); setError("")
    const res = await fetch("/api/public/broker-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: first, lastName: last, nationalId: nid,
        address: fd.get("address"), phone: fd.get("phone"), lineId: fd.get("lineId") || "",
        position: fd.get("position") || "", company: fd.get("company") || "",
        bankAccountNo: fd.get("bankAccountNo"), bankName: bank === "อื่น ๆ" ? fd.get("bankOther") : bank,
        bankAccountName: shownAccName,
        center, centerOther: fd.get("centerOther") || "",
        consentPdpa: fd.get("consentPdpa") === "on", confirmTrue: fd.get("confirmTrue") === "on",
        website: fd.get("website") || "",
      }),
    }).catch(() => null)
    if (res?.ok) { setState("done"); window.scrollTo({ top: 0, behavior: "smooth" }); return }
    const j = await res?.json().catch(() => ({})) ?? {}
    setError(j.error ?? "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือโทรหาฝ่ายขาย")
    setState("idle")
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[var(--mena-green-soft)] bg-white p-8">
        <p className="text-xl font-medium text-[var(--mena-green)]">ได้รับใบสมัครแล้ว</p>
        <p className="mt-2 leading-[1.9] text-[var(--mena-ink)]/70">
          ฝ่ายขายจะตรวจข้อมูลแล้วโทรกลับภายใน 2–3 วันทำการ ระหว่างนี้ถ้ามีคนสนใจซื้อรถแล้ว โทรบอกฝ่ายขายได้เลย ไม่ต้องรออนุมัติ
        </p>
        {phone && (
          <a href={telHref(phone)} className="mt-5 inline-block rounded-full bg-[var(--mena-green)] text-white px-6 py-3 font-medium">
            โทร {phone}
          </a>
        )}
      </div>
    )
  }

  const field = "w-full rounded-xl border border-[var(--mena-line)] px-4 py-3 bg-white placeholder:text-[var(--mena-ink)]/35 focus-visible:outline-2 focus-visible:outline-[var(--mena-green)]"
  const label = "block text-sm font-medium mb-1.5"
  const req = <span className="text-[var(--mena-red)]" aria-hidden="true"> *</span>
  const box = "rounded-2xl border border-[var(--mena-line)] bg-white p-6 sm:p-8"
  const heading = "text-lg font-medium text-[var(--mena-green)]"

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset className={box}>
        <legend className="sr-only">ข้อมูลผู้สมัคร</legend>
        <p className={heading}>1. ข้อมูลผู้สมัคร</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="b-first" className={label}>ชื่อ{req}</label>
            <input id="b-first" required autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="b-last" className={label}>นามสกุล{req}</label>
            <input id="b-last" required autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="b-nid" className={label}>เลขบัตรประชาชน 13 หลัก{req}</label>
            <input
              id="b-nid" required inputMode="numeric" maxLength={17} value={nid} onChange={(e) => setNid(e.target.value)}
              aria-invalid={nidBad} aria-describedby="b-nid-hint" className={`${field} tabular-nums ${nidBad ? "border-[var(--mena-red)]" : ""}`}
            />
            <p id="b-nid-hint" className={`mt-1 text-xs ${nidBad ? "text-[var(--mena-red)]" : "text-[var(--mena-ink)]/50"}`}>
              {nidBad ? "เลขนี้ไม่ตรงกับเลขบัตรประชาชนจริง ลองเช็กอีกรอบ" : "ใช้ออกหนังสือรับรองหัก ณ ที่จ่ายตอนจ่ายค่าคอม"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="b-addr" className={label}>ที่อยู่ตามบัตรประชาชน{req}</label>
            <textarea id="b-addr" name="address" required rows={2} autoComplete="street-address" className={field} />
          </div>
          <div>
            <label htmlFor="b-phone" className={label}>เบอร์โทรศัพท์{req}</label>
            <input id="b-phone" name="phone" required inputMode="tel" autoComplete="tel" placeholder="0812345678" className={field} />
          </div>
          <div>
            <label htmlFor="b-line" className={label}>LINE ID</label>
            <input id="b-line" name="lineId" className={field} />
          </div>
          <div>
            <label htmlFor="b-pos" className={label}>ตำแหน่งงาน</label>
            <input id="b-pos" name="position" placeholder="ถ้ามี" className={field} />
          </div>
          <div>
            <label htmlFor="b-com" className={label}>บริษัท</label>
            <input id="b-com" name="company" placeholder="ถ้ามี" className={field} />
          </div>
        </div>
      </fieldset>

      <fieldset className={box}>
        <legend className="sr-only">ข้อมูลการรับเงิน</legend>
        <p className={heading}>2. บัญชีรับค่าคอม</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="b-bank" className={label}>ธนาคาร{req}</label>
            <select id="b-bank" required value={bank} onChange={(e) => setBank(e.target.value)} className={field}>
              <option value="" disabled>เลือกธนาคาร</option>
              {THAI_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value="อื่น ๆ">อื่น ๆ</option>
            </select>
            {bank === "อื่น ๆ" && (
              <input name="bankOther" required aria-label="ชื่อธนาคาร" placeholder="พิมพ์ชื่อธนาคาร" className={`${field} mt-2`} />
            )}
          </div>
          <div>
            <label htmlFor="b-accno" className={label}>เลขที่บัญชี{req}</label>
            <input id="b-accno" name="bankAccountNo" required inputMode="numeric" className={`${field} tabular-nums`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="b-accname" className={label}>ชื่อบัญชี{req}</label>
            <input
              id="b-accname" required value={shownAccName}
              onChange={(e) => { setAccNameTouched(true); setAccName(e.target.value) }} className={field}
            />
            <p className="mt-1 text-xs text-[var(--mena-ink)]/50">ต้องเป็นบัญชีชื่อผู้สมัครเอง บริษัทโอนเข้าบัญชีคนอื่นให้ไม่ได้</p>
          </div>
        </div>
      </fieldset>

      <fieldset className={box}>
        <legend className={heading}>3. สังกัดศูนย์{req}</legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {BROKER_CENTERS.map((c) => (
            <label
              key={c.key}
              className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--mena-green)] ${center === c.key
                ? "border-[var(--mena-green)] bg-[var(--mena-green)] text-white font-medium"
                : "border-[var(--mena-line)] bg-white hover:border-[var(--mena-green-soft)]"}`}
            >
              <input type="radio" name="center" value={c.key} required checked={center === c.key} onChange={() => setCenter(c.key)} className="sr-only" />
              {c.label}
            </label>
          ))}
        </div>
        {center === "other" && (
          <input name="centerOther" required aria-label="ชื่อศูนย์" placeholder="พิมพ์ชื่อศูนย์" className={`${field} mt-3 sm:max-w-sm`} />
        )}
      </fieldset>

      <fieldset className={box}>
        <legend className="sr-only">ยืนยันข้อมูล</legend>
        <p className={heading}>4. ยืนยันข้อมูล</p>
        <div className="mt-4 space-y-3 text-sm leading-[1.8]">
          <label className="flex gap-3 cursor-pointer">
            <input type="checkbox" name="confirmTrue" required className="mt-1 h-5 w-5 shrink-0 accent-[var(--mena-green)]" />
            <span>ข้าพเจ้าขอยืนยันว่าข้อมูลเป็นความจริงทุกประการ</span>
          </label>
          <label className="flex gap-3 cursor-pointer">
            <input type="checkbox" name="consentPdpa" required className="mt-1 h-5 w-5 shrink-0 accent-[var(--mena-green)]" />
            <span>
              ยินยอมให้บริษัท มีนาทรานสปอร์ต จำกัด (มหาชน) เก็บเลขบัตรประชาชน ที่อยู่ และเลขบัญชีนี้
              ไว้ใช้ตรวจสอบตัวตน จ่ายค่าคอม และออกเอกสารภาษีเท่านั้น
            </span>
          </label>
        </div>
      </fieldset>

      {/* honeypot — ซ่อนจากคน บอทมักกรอก */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {error && <p role="alert" className="rounded-xl bg-[var(--mena-red)]/10 text-[var(--mena-red)] px-4 py-3 text-sm">{error}</p>}
      <button
        disabled={state === "sending" || nidBad}
        className="w-full sm:w-auto rounded-full bg-[var(--mena-green)] text-white font-medium px-10 py-3.5 hover:bg-[var(--mena-green-soft)] transition-colors disabled:opacity-50"
      >
        {state === "sending" ? "กำลังส่ง…" : "ส่งใบสมัคร"}
      </button>
    </form>
  )
}
