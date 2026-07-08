"use client"

/**
 * Searchable combobox — พิมพ์ค้นหาแล้วเลือกจากรายการ
 * ใช้ร่วมกันระหว่างหน้าเพิ่มสัญญา (/contracts/new) และหน้าแก้ไขสัญญา (/contracts/[id])
 */

import { useEffect, useRef, useState } from "react"
import { Search, X, ChevronDown } from "lucide-react"

export interface SearchComboboxProps<T> {
  items:       T[]
  selected:    T | null
  onSelect:    (item: T | null) => void
  getLabel:    (item: T) => string
  getSub?:     (item: T) => string
  placeholder: string
  searchKeys:  (item: T) => string[]
}

export function SearchCombobox<T extends { _id?: string }>({
  items, selected, onSelect, getLabel, getSub, placeholder, searchKeys,
}: SearchComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const [q,    setQ]    = useState("")
  const ref             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = items.filter((item) =>
    !q || searchKeys(item).some((k) => k.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-sm">
          <span className="flex-1 truncate font-medium text-zinc-800 dark:text-zinc-100">{getLabel(selected)}</span>
          {getSub && <span className="text-xs text-zinc-400">{getSub(selected)}</span>}
          <button type="button" onClick={() => { onSelect(null); setQ("") }} className="text-zinc-400 hover:text-zinc-700 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 cursor-text"
          onClick={() => setOpen(true)}
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400 min-w-0"
            placeholder={placeholder}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-400">ไม่พบข้อมูล</div>
          ) : filtered.slice(0, 60).map((item) => (
            <button
              key={item._id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between"
              onMouseDown={(e) => { e.preventDefault(); onSelect(item); setOpen(false); setQ("") }}
            >
              <span className="font-medium">{getLabel(item)}</span>
              {getSub && <span className="text-xs text-zinc-400">{getSub(item)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
