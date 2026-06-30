"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Contract } from "@/types"

const EMPTY: Omit<Contract, "_id" | "createdAt" | "updatedAt"> = {
  contractCode: "", contractDate: "", buyerName: "", driverName: "",
  accountNumber: "", phone: "", plant: "", truckNumber: "", licensePlate: "",
  vehicleBrand: "", totalPrice: 0, downPayment: 0, monthlyInstallment: 0,
  totalInstallments: 0, startDate: "", status: "active", notes: "",
  insurer: "", taxRenewalDate: "", taxExpiryDate: "",
  monthlyInsuranceFee: 0, insuranceAmount: 0, prbAmount: 0, taxAmount: 0,
}

export default function NewContractPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [form, setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  function field(key: keyof typeof EMPTY) {
    return {
      value: String(form[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const v = e.target.value
        setForm((p) => ({ ...p, [key]: typeof p[key] === "number" ? Number(v) : v }))
      },
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (session?.user?.role !== "admin") return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "เกิดข้อผิดพลาด")
        return
      }
      router.push("/contracts")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-6">เพิ่มสัญญาเช่าซื้อใหม่</h1>
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── ข้อมูลสัญญา ─── */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">ข้อมูลสัญญา</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>รหัสสัญญา *</Label>
              <Input {...field("contractCode")} required placeholder="MTL003" />
            </div>
            <div className="space-y-1">
              <Label>วันที่ทำสัญญา *</Label>
              <Input {...field("contractDate")} type="date" required />
            </div>
            <div className="space-y-1">
              <Label>ชื่อผู้เช่าซื้อ *</Label>
              <Input {...field("buyerName")} required />
            </div>
            <div className="space-y-1">
              <Label>ชื่อผู้ขับขี่ *</Label>
              <Input {...field("driverName")} required />
            </div>
            <div className="space-y-1">
              <Label>เลขที่บัญชีผู้เช่าซื้อ</Label>
              <Input {...field("accountNumber")} />
            </div>
            <div className="space-y-1">
              <Label>เบอร์โทร</Label>
              <Input {...field("phone")} type="tel" />
            </div>
            <div className="space-y-1">
              <Label>แพล้นท์</Label>
              <Input {...field("plant")} placeholder="หนามแดง" />
            </div>
            <div className="space-y-1">
              <Label>เบอร์รถ</Label>
              <Input {...field("truckNumber")} placeholder="ME009" />
            </div>
            <div className="space-y-1">
              <Label>ทะเบียน</Label>
              <Input {...field("licensePlate")} placeholder="สบ.71-1956" />
            </div>
            <div className="space-y-1">
              <Label>ยี่ห้อรถ</Label>
              <Input {...field("vehicleBrand")} placeholder="HINO" />
            </div>
            <div className="space-y-1">
              <Label>สถานะ</Label>
              <select {...field("status")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="active">ใช้งาน</option>
                <option value="completed">สิ้นสุด</option>
                <option value="terminated">ยกเลิก</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>วันที่เริ่มผ่อนงวดแรก</Label>
              <Input {...field("startDate")} type="date" />
            </div>
          </div>
        </div>

        {/* ─── ข้อมูลการเงิน ─── */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">ข้อมูลการเงิน</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>ราคารถรวม (บาท)</Label>
              <Input {...field("totalPrice")} type="number" min="0" />
            </div>
            <div className="space-y-1">
              <Label>เงินดาวน์ (บาท)</Label>
              <Input {...field("downPayment")} type="number" min="0" />
            </div>
            <div className="space-y-1">
              <Label>ค่างวด/เดือน (บาท)</Label>
              <Input {...field("monthlyInstallment")} type="number" min="0" />
            </div>
            <div className="space-y-1">
              <Label>จำนวนงวดรวม</Label>
              <Input {...field("totalInstallments")} type="number" min="0" />
            </div>
          </div>
        </div>

        {/* ─── ประกัน / ภาษี ─── */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">ข้อมูลประกันภัย / ภาษี</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>บริษัทประกัน</Label>
              <Input {...field("insurer")} placeholder="ชื่อบริษัทประกัน" />
            </div>
            <div className="space-y-1">
              <Label>ค่าประกัน/ภาษี ต่อเดือน (บาท)</Label>
              <Input {...field("monthlyInsuranceFee")} type="number" min="0" />
            </div>
            <div className="space-y-1">
              <Label>วันต่อล่าสุด</Label>
              <Input {...field("taxRenewalDate")} type="date" />
            </div>
            <div className="space-y-1">
              <Label>วันหมดอายุ</Label>
              <Input {...field("taxExpiryDate")} type="date" />
            </div>
            <div className="space-y-1">
              <Label>เบี้ยประกันภัย (บาท)</Label>
              <Input {...field("insuranceAmount")} type="number" min="0" />
            </div>
            <div className="space-y-1">
              <Label>เบี้ย พรบ (บาท)</Label>
              <Input {...field("prbAmount")} type="number" min="0" />
            </div>
            <div className="space-y-1">
              <Label>ค่าภาษีทะเบียน (บาท)</Label>
              <Input {...field("taxAmount")} type="number" min="0" />
            </div>
          </div>
        </div>

        {/* ─── หมายเหตุ ─── */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">หมายเหตุ</h2>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={3}
            placeholder="บันทึกหมายเหตุเพิ่มเติม..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
        </div>
      </form>
    </div>
  )
}
