export type ContractStatus = "active" | "completed" | "terminated"
export type DriverStatus = "active" | "inactive"
export type UserRole = "admin" | "viewer"

export interface Contract {
  _id?: string
  contractCode: string
  contractDate: string          // ISO date string
  buyerName: string
  driverName: string
  accountNumber: string
  phone: string
  plant: string
  truckNumber: string
  licensePlate: string
  vehicleBrand: string
  totalPrice: number
  downPayment: number
  monthlyInstallment: number
  totalInstallments: number
  startDate: string             // ISO date string
  status: ContractStatus
  notes: string
  // Insurance / tax fields (from ภาษี ประกัน พรบ sheet)
  insurer?: string
  insuranceCompany?: string
  insuranceAmount?: number
  prbAmount?: number
  taxAmount?: number
  inspectionCost?: number
  taxInsuranceTotalCost?: number
  monthlyInsuranceFee?: number
  taxRenewalDate?: string       // ISO date string YYYY-MM-DD
  taxExpiryDate?: string        // ISO date string YYYY-MM-DD
  taxEndDate?: string           // coverage end date
  taxInstallmentCount?: number
  taxMonthlyInstallment?: number
  taxMonthlyCollection?: number
  taxBalanceRemaining?: number
  taxInstallmentStart?: string
  taxInstallmentEnd?: string
  // Reserve / overdue fields (from เบิกสำรอง sheet)
  dueInstallmentNo?: number
  overdueCount?: number
  overdueAmount?: number
  otherDebtBalance?: number
  repairReserve?: number
  installmentReserve?: number
  totalReserveBalance?: number
  netPayLastMonth?: number
  emergencyDraw?: number
  reserveDraw?: number
  reserveNote?: string
  drawLimit?: number
  reserveAsOfMonth?: string
  createdAt?: string
  updatedAt?: string
}

export interface Driver {
  _id?: string
  contractCode: string
  buyerName: string
  driverName: string
  truckNumber: string
  licensePlate: string
  phone: string
  plant: string
  status: DriverStatus
  createdAt?: string
}

export interface PayrollIncomeFields {
  transportFee: number
  ot: number
  otherIncomeWHT: number
  otherIncomeNoWHT: number
}

export interface PayrollDeductionFields {
  fuel: number
  gps: number
  repairInHouse: number
  repairOutside: number
  mgmtFee8pct: number
  labor: number
  tire: number
  tirePatch: number
  carWash: number
  taxInsurance: number
  installment: number
  repairInstallment: number
  downPaymentInstallment: number
}

export interface PayrollEntry extends PayrollIncomeFields, PayrollDeductionFields {
  _id?: string
  contractCode: string
  month: string                 // "YYYY-MM"
  workingDays: number
  tripCount: number
  totalIncome: number
  totalDeductions: number
  netPay: number
  createdAt?: string
  updatedAt?: string
}

export interface Trip {
  _id?: string
  contractCode: string
  date: string                  // ISO date string
  ldtNumber: string
  plant: string
  serviceType: string
  routeCode: string
  destinationName: string
  district: string
  province: string
  zone: string
  tripFee: number
  createdAt?: string
}

export interface PayrollComputed {
  totalIncome: number
  totalDeductions: number
  netPay: number
}

export interface PromoConfig {
  _id?: string
  contractCode?: string
  licensePlate: string
  repairBudget: number
  pmOilCost: number
  annualPmCap: number
  createdAt?: string
}

export interface RepairClaim {
  _id?: string
  contractCode: string
  date: string
  description: string
  amount: number
  createdAt?: string
}

export interface PmRecord {
  _id?: string
  contractCode: string
  year: number
  type: "PM1" | "PM2"
  date: string
  amount: number
  notes: string
  createdAt?: string
}

export interface PromoSummaryRow {
  contractCode: string
  licensePlate: string
  driverName: string
  truckNumber: string
  repairBudget: number
  repairUsed: number
  repairRemaining: number
  annualPmCap: number
  pmUsedThisYear: number
  pmRemainingThisYear: number
  pm1UsedThisYear: boolean
  pm2UsedThisYear: boolean
}

export interface PromoDetail extends PromoSummaryRow {
  pmOilCost: number
  repairClaims: RepairClaim[]
  pmRecords: PmRecord[]
}
