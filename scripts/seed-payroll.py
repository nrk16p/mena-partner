"""
Seed payroll_entries for month 2026-05 from Summary sheet.

Column mapping (0-indexed):
  0:  contractCode
  8:  workingDays
  9:  tripCount
  10: transportFee
  11: ot (OT)
  12: otherIncomeWHT
  13: otherIncomeNoWHT
  14: fuel
  15: gps
  16: repairInHouse
  17: repairOutside
  18: mgmtFee8pct
  19: labor
  20: tire
  21: tirePatch
  22: carWash
  23: taxInsurance
  27: installment (ค่างวดรถ)
  28: repairInstallment (ผ่อนชำระค่าซ่อม)
  30: downPaymentInstallment (ผ่อนเงินดาวน์)

Run: python3 scripts/seed-payroll.py  (from project root)
"""
import openpyxl
from pymongo import MongoClient, UpdateOne
from datetime import datetime, timezone

MONGO_URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME    = "mena_partner"
EXCEL_PATH = "Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx"
MONTH      = "2026-05"

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
now    = datetime.now(timezone.utc)

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb["Summary"]

rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
print(f"Non-empty rows: {len(rows)}")

def f(val, default=0.0):
    """Safe float conversion."""
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default

ops = []
skipped = []

for row in rows:
    code = row[0]
    if not code:
        continue
    code = str(code).strip()
    if not (code.startswith("MTL") or code.startswith("MTM")):
        continue

    transport_fee        = f(row[10])
    ot                   = f(row[11])
    other_income_wht     = f(row[12])
    other_income_no_wht  = f(row[13])
    fuel                 = f(row[14])
    gps                  = f(row[15])
    repair_in_house      = max(0.0, f(row[16]))  # clamp float rounding artifacts
    repair_outside       = f(row[17])
    mgmt_fee             = f(row[18])
    labor                = f(row[19])
    tire                 = f(row[20])
    tire_patch           = f(row[21])
    car_wash             = f(row[22])
    tax_insurance        = f(row[23])
    installment          = f(row[27])
    repair_installment   = f(row[28])
    down_payment_inst    = f(row[30])

    total_income     = transport_fee + ot + other_income_wht + other_income_no_wht
    total_deductions = (fuel + gps + repair_in_house + repair_outside + mgmt_fee
                        + labor + tire + tire_patch + car_wash + tax_insurance
                        + installment + repair_installment + down_payment_inst)
    net_pay = total_income - total_deductions

    doc = {
        "contractCode":          code,
        "month":                 MONTH,
        "workingDays":           int(f(row[8])),
        "tripCount":             int(f(row[9])),
        "transportFee":          transport_fee,
        "ot":                    ot,
        "otherIncomeWHT":        other_income_wht,
        "otherIncomeNoWHT":      other_income_no_wht,
        "fuel":                  fuel,
        "gps":                   gps,
        "repairInHouse":         repair_in_house,
        "repairOutside":         repair_outside,
        "mgmtFee8pct":           mgmt_fee,
        "labor":                 labor,
        "tire":                  tire,
        "tirePatch":             tire_patch,
        "carWash":               car_wash,
        "taxInsurance":          tax_insurance,
        "installment":           installment,
        "repairInstallment":     repair_installment,
        "downPaymentInstallment": down_payment_inst,
        "totalIncome":           round(total_income, 2),
        "totalDeductions":       round(total_deductions, 2),
        "netPay":                round(net_pay, 2),
        "updatedAt":             now,
    }

    ops.append(UpdateOne(
        {"contractCode": code, "month": MONTH},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True
    ))

print(f"Entries to upsert: {len(ops)}")
if ops:
    result = db["payroll_entries"].bulk_write(ops)
    print(f"Upserted: {result.upserted_count}  Modified: {result.modified_count}")

if skipped:
    print(f"Skipped: {skipped}")

# Spot-check MTL003 (expected: transportFee≈79799, fuel≈38999, workingDays=31, tripCount=83)
sample = db["payroll_entries"].find_one({"contractCode": "MTL003", "month": MONTH}, {"_id": 0})
if sample:
    print(f"\nSpot-check MTL003:")
    print(f"  workingDays={sample['workingDays']} tripCount={sample['tripCount']}")
    print(f"  transportFee={sample['transportFee']} fuel={sample['fuel']}")
    print(f"  totalIncome={sample['totalIncome']} totalDeductions={sample['totalDeductions']} netPay={sample['netPay']}")
else:
    print("Spot-check: MTL003 not found")

client.close()
print("Done.")
