/** บัญชีรับเงินของเซลล์/นายหน้า — เก็บแยก 3 ช่อง แสดงรวมเป็นบรรทัดเดียว "กสิกรไทย · 0758997766 · กนกวรรณ วงษ์ชาลี" */
export interface BankAccount {
  bankName?: string
  bankAccountNo?: string
  bankAccountName?: string
}

export function formatBankAccount(b?: BankAccount | null): string {
  if (!b) return ""
  return [b.bankName, b.bankAccountNo, b.bankAccountName].map((v) => String(v ?? "").trim()).filter(Boolean).join(" · ")
}

export const hasBankAccount = (b?: BankAccount | null) => !!(b && String(b.bankAccountNo ?? "").trim())
