"""
Seed fuel_records collection from 'ค่าขนส่ง' sheet.
Stores the pre-calculated fuel deduction amount per contract per month.

Column mapping (data starts row 3, 0-indexed):
  0:  contractCode
  26: deductionAmount (หักค่าเชื้อเพลิง บาท)

Run: python3 scripts/seed-fuel-records.py  (from project root)
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
ws = wb["ค่าขนส่ง"]

rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
data = [r for r in rows if r[0] and str(r[0]).strip().startswith("MT")]
print(f"Transport rows: {len(data)}")

def to_float(v):
    try:
        return float(str(v).replace(",", "")) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

ops = []
for row in data:
    code   = str(row[0]).strip()
    amount = to_float(row[26]) if len(row) > 26 else 0.0
    doc = {
        "contractCode":    code,
        "month":           MONTH,
        "deductionAmount": round(amount, 2),
        "updatedAt":       now,
    }
    ops.append(UpdateOne(
        {"contractCode": code, "month": MONTH},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True
    ))

print(f"Ops to upsert: {len(ops)}")
if ops:
    r = db["fuel_records"].bulk_write(ops)
    print(f"Upserted: {r.upserted_count}  Modified: {r.modified_count}")

sample = db["fuel_records"].find_one({"contractCode": "MTL003", "month": MONTH})
if sample:
    print(f"Spot-check MTL003 fuel deduction={sample['deductionAmount']}")

client.close()
print("Done.")
