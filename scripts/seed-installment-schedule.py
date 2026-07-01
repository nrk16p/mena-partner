"""
Seed installment_schedule collection from 'เก็บค่างวดรายเดือน' sheet.
Stores per-contract installment amount (actual monthly collected, not contract face value).

Column mapping (data starts row 4, 0-indexed):
  1:  contractCode (รหัสสัญญา)
  5:  monthlyAmount (ค่างวดใหม่) — the actual monthly payment rate

Run: python3 scripts/seed-installment-schedule.py  (from project root)
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

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb["เก็บค่างวดรายเดือน"]

rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
data = [r for r in rows if r[1] and str(r[1]).strip().startswith("MT")]
print(f"Installment rows: {len(data)}")

def to_float(v):
    try:
        return float(str(v).replace(",", "")) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

ops = []
for row in data:
    code   = str(row[1]).strip()
    amount = to_float(row[5])
    doc = {
        "contractCode":  code,
        "monthlyAmount": amount,
        "updatedAt":     now,
    }
    ops.append(UpdateOne(
        {"contractCode": code},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True
    ))

print(f"Ops to upsert: {len(ops)}")
if ops:
    r = db["installment_schedule"].bulk_write(ops)
    print(f"Upserted: {r.upserted_count}  Modified: {r.modified_count}")

# Spot-check
sample = db["installment_schedule"].find_one({"contractCode": "MTL003"})
if sample:
    print(f"Spot-check MTL003 monthlyAmount={sample['monthlyAmount']}")

client.close()
print("Done.")
