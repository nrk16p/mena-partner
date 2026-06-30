"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Contract } from "@/types"

export default function ContractDetailPage() {
  const { id }             = useParams<{ id: string }>()
  const router             = useRouter()
  const { data: session }  = useSession()
  const isAdmin            = session?.user?.role === "admin"
  const [form, setForm]    = useState<Contract | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]  = useState("")

  useEffect(() => {
    fetch(`/api/contracts/${id}`).then((r) => r.json()).then(setForm)
  }, [id])

  function field(key: keyof Contract) {
    return {
      value: String(form?.[key] ?? ""),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const v = e.target.value
        setForm((p) => p ? ({ ...p, [key]: typeof p[key] === "number" ? Number(v) : v }) : p)
      },
      disabled: !isAdmin,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !isAdmin) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); return }
      router.push("/contracts")
    } finally { setSaving(false) }
  }

  if (!form) return <div className="text-zinc-400 text-sm">กำลังโหลด...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-1">สัญญา {form.contractCode}</h1>
      <p className="text-sm text-zinc-400 mb-6">{form.buyerName}</p>
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</div>}
      <form onSubmit={handleSave} className="space-y-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="grid grid-cols-2 gap-4">
          {(["contractCode","contractDate","buyerName","driverName","accountNumber","phone","plant","truckNumber","licensePlate","vehicleBrand"] as (keyof Contract)[]).map((key) => (
            <div key={key} className="space-y-1">
              <Label>{key}</Label>
              <Input {...field(key)} />
            </div>
          ))}
          {(["totalPrice","downPayment","monthlyInstallment","totalInstallments"] as (keyof Contract)[]).map((key) => (
            <div key={key} className="space-y-1">
              <Label>{key}</Label>
              <Input {...field(key)} type="number" min="0" />
            </div>
          ))}
          <div className="space-y-1">
            <Label>startDate</Label>
            <Input {...field("startDate")} type="date" />
          </div>
          <div className="space-y-1">
            <Label>สถานะ</Label>
            <select {...field("status")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="active">ใช้งาน</option>
              <option value="completed">สิ้นสุด</option>
              <option value="terminated">ยกเลิก</option>
            </select>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>ยกเลิก</Button>
          </div>
        )}
      </form>
    </div>
  )
}
