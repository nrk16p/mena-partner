"""
Seed tax/insurance/compulsory insurance data from ' ภาษี ประกัน พรบ' sheet.
Updates contracts collection with vehicle renewal fields.

Column mapping (data starts row 3, 0-indexed):
  0:  contractCode
  3:  licensePlate
  4:  taxRenewalDate (DD/MM/YYYY)
  5:  taxEndDate     (DD/MM/YYYY)
  6:  insuranceCompany
  7:  insuranceAmount
  8:  prbAmount (พรบ)
  9:  taxAmount (ภาษี)
  10: inspectionCost (ตรวจสภาพรถ)
  11: taxInsuranceTotalCost (รวม)
  12: taxInstallmentCount
  13: taxMonthlyInstallment (งวดละ)
  14: taxInstallmentStart
  15: taxInstallmentEnd
  17: taxMonthlyCollection (ยอดเก็บรายเดือน)
  18: taxBalanceRemaining (คงเหลือหัก)

Run: python3 scripts/seed-tax-insurance.py  (from project root)
"""
import openpyxl
from pymongo import MongoClient, UpdateOne
from datetime import datetime, timezone

MONGO_URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME    = "mena_partner"
EXCEL_PATH = "Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx"

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
now    = datetime.now(timezone.utc)

def parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 3:
            d, m, y = parts[0].zfill(2), parts[1].zfill(2), parts[2][:4]
            return f"{y}-{m}-{d}"
    return s[:10] if len(s) >= 10 else s

def to_float(val):
    try:
        return float(str(val).replace(",", "")) if val is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

def clean(val):
    return str(val).strip() if val is not None else ""

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb[" ภาษี ประกัน พรบ"]
rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
data = [r for r in rows[3:] if r[0] and str(r[0]).startswith("MT")]
print(f"Rows to process: {len(data)}")

ops = []
for row in data:
    code = clean(row[0])
    tax_end = parse_date(row[5])
    update = {
        "taxRenewalDate":        parse_date(row[4]),
        "taxEndDate":            tax_end,
        "taxExpiryDate":         tax_end,   # keep existing alert logic working
        "insuranceCompany":      clean(row[6]),
        "insurer":               clean(row[6]),  # map to existing field
        "insuranceAmount":       to_float(row[7]),
        "prbAmount":             to_float(row[8]),
        "taxAmount":             to_float(row[9]),
        "inspectionCost":        to_float(row[10]),
        "taxInsuranceTotalCost": to_float(row[11]),
        "taxInstallmentCount":   int(to_float(row[12])) if row[12] else 0,
        "taxMonthlyInstallment": to_float(row[13]),
        "taxInstallmentStart":   parse_date(row[14]),
        "taxInstallmentEnd":     parse_date(row[15]),
        "taxMonthlyCollection":  to_float(row[17]) if len(row) > 17 else 0.0,
        "taxBalanceRemaining":   to_float(row[18]) if len(row) > 18 else 0.0,
        "updatedAt":             now,
    }
    ops.append(UpdateOne({"contractCode": code}, {"$set": update}))

if ops:
    r = db["contracts"].bulk_write(ops)
    print(f"Matched: {r.matched_count}  Modified: {r.modified_count}")

# Summary: contracts expiring soonest
from datetime import date
today_str = date.today().isoformat()
expiring = list(db["contracts"].find(
    {"taxRenewalDate": {"$gte": today_str}},
    {"contractCode": 1, "taxRenewalDate": 1, "taxEndDate": 1, "insuranceCompany": 1, "_id": 0}
).sort("taxRenewalDate", 1).limit(5))
print(f"\nEarliest upcoming renewals:")
for c in expiring:
    print(f"  {c['contractCode']} → renew {c['taxRenewalDate']} | end {c.get('taxEndDate')} | {c.get('insuranceCompany')}")

client.close()
print("\n✓ Done.")
