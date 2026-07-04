export type ContractStatus = "active" | "completed" | "terminated"
export type DriverStatus = "active" | "inactive"
export type UserRole = "admin" | "viewer"

export interface Vehicle {
  _id?: string
  vehicleType?:    string   // ประเภทรถ
  characteristic?: string  // ลักษณะ
  brand?:          string  // ยี่ห้อ
  model?:          string  // รุ่น
  registrationDate?: string // YYYY-MM-DD วันจดทะเบียน
  color?:          string  // สีรถ
  licensePlate?:   string  // ทะเบียนรถ
  truckNumber?:    string  // เบอร์รถ
  chassisNumber?:  string  // เลขตัวถัง
  engineNumber?:   string  // เลขเครื่อง
  engineSize?:     string  // ขนาดกำลังเครื่องยนต์
  status?:              string  // active / inactive
  registrationDocUrl?:  string  // URL สำเนาทะเบียนรถ
  createdAt?: string
  updatedAt?: string
}

export interface Contract {
  _id?: string
  contractCode: string
  contractDate: string          // ISO date string
  // Driver / personal data
  driverId?:       string       // ref to drivers._id
  buyerName:       string
  driverName:      string
  birthDate?:      string       // YYYY-MM-DD from driver
  nationalId?:     string       // 13 digits from driver
  driverAddress?:  string       // from driver
  accountNumber:   string
  bankName?:       string
  phone:           string
  plant:           string
  // Vehicle data
  vehicleId?:              string  // ref to vehicle_master._id
  truckNumber:             string
  licensePlate:            string
  vehicleBrand:            string  // ยี่ห้อ
  vehicleModel?:           string  // รุ่น
  vehicleType?:            string  // ประเภทรถ
  vehicleCharacteristic?:  string  // ลักษณะ
  vehicleRegistrationDate?: string // วันจดทะเบียน
  vehicleColor?:           string  // สีรถ
  chassisNumber?:          string  // เลขตัวถัง
  engineNumber?:           string  // เลขเครื่อง
  engineSize?:             string  // ขนาดกำลังเครื่องยนต์
  mileage?:                number  // ระยะทางที่ใช้แล้ว (กม.) — ใช้ในเอกสารสัญญา
  // Financial (from master_price_list, keyed by licensePlate)
  totalPrice:          number   // totalSalePrice
  downPayment:         number   // เงินดาวน์รวม
  cashDown?:           number   // เงินดาวน์สด
  remainingInstallment?: number // งวดดาวน์คงเหลือ
  downInstallmentCount?: number // จำนวนงวดดาวน์
  downInstallmentAmt?: number   // ค่างวดดาวน์
  financeAmount?:      number   // ยอดไฟแนนซ์
  monthlyInstallment:  number   // monthlyPayment
  totalInstallments:   number   // financeInstallments
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
  payEveryLastDay?: boolean      // จ่ายทุกวันสุดท้ายของเดือน
  saleContractUrl?:      string  // สัญญาซื้อขาย
  hireContractUrl?:      string  // สัญญาว่าจ้าง
  guaranteeContractUrl?: string  // สัญญาค้ำประกัน
  attachments?: string[]        // public URLs of uploaded files (legacy)
  createdAt?: string
  updatedAt?: string
}

export interface Driver {
  _id?: string
  firstName:      string
  lastName:       string
  birthDate?:     string   // YYYY-MM-DD
  nationalId?:    string   // 13 digits
  address?:       string
  staffCode?:     string   // รหัสพนักงาน
  phone?:         string   // เบอร์โทรศัพท์
  bankName?:      string   // ธนาคาร
  accountNumber?: string   // เลขที่บัญชี
  idCardUrl?:      string   // URL ภาพบัตรประชาชน
  licenseUrl?:     string   // URL ใบขับขี่
  houseRegUrl?:    string   // URL ทะเบียนบ้าน
  licenseNumber?:  string   // เลขบัตรใบขับขี่
  licenseType?:    string   // ประเภทใบขับขี่
  licenseExpiry?:  string   // วันหมดอายุ YYYY-MM-DD
  isTruckOwner?:  boolean  // เป็นเจ้าของรถ
  isDriver?:      boolean  // เป็นพนักงานขับรถ
  startDate?:     string   // YYYY-MM-DD เริ่มงานวันที่
  endDate?:       string   // YYYY-MM-DD สิ้นสุด
  status:         DriverStatus
  createdAt?: string
  updatedAt?: string
  // legacy — optional so old pages don't break at compile time
  contractCode?: string
  buyerName?:    string
  driverName?:   string
  truckNumber?:  string
  licensePlate?: string
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

export interface GpsConfig {
  _id?: string
  contractCode: string
  truckNumber: string
  licensePlate: string
  vendor: string
  installDate?: string
  boxNumber: string
  chassisNumber: string
  startDate?: string
  fleet: string
  plant: string
  monthlyFee: number
}

export interface InstallmentSchedule {
  _id?: string
  contractCode: string
  monthlyAmount: number
  updatedAt?: string
}

export interface FuelRecord {
  _id?: string
  contractCode: string
  month: string
  deductionAmount: number
}

export interface MonthlyAdjustment {
  _id?: string
  contractCode: string
  month: string
  otherIncomeWHT: number
  otherIncomeNoWHT: number
  otherDeductWHT: number
  otherDeductNoWHT: number
  note?: string
  updatedAt?: string
}

export type MonthPhase = "draft" | "review" | "approved" | "locked"

export interface MonthStatus {
  _id?: string
  month: string
  phase: MonthPhase
  updatedAt: string
  updatedBy?: string
  notes?: string
}

export interface RepairMonthly {
  _id?: string
  contractCode: string
  month: string
  driverName?: string
  truckNumber?: string
  licensePlate?: string
  partsAmount: number
  tireAmount: number
  tirePatchAmount: number
  cleaningAmount: number
  outsideRepairAmount: number
  managementFee: number
  laborAmount: number
  totalRepair: number
  liabilityTotal?: number
  liabilityThisMonth?: number
}
