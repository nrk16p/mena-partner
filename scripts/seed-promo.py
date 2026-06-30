"""
Seed script: reads โปรโมชั่น ซ่อม+PM sheet from Excel
and upserts into MongoDB promo_config collection.
"""
import openpyxl
from pymongo import MongoClient, UpdateOne
import os, sys

MONGO_URI = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME   = "mena_partner"
EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx")
SHEET_NAME = "โปรโมชั่น ซ่อม+PM"

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]

# Build licensePlate -> contractCode map from contracts
contracts = list(db["contracts"].find({}, {"licensePlate": 1, "contractCode": 1, "_id": 0}))
plate_to_code = {c["licensePlate"]: c["contractCode"] for c in contracts if c.get("licensePlate")}
print(f"Loaded {len(plate_to_code)} contracts from DB")

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
ws = wb[SHEET_NAME]

rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
header = rows[0]
data   = rows[1:]
print(f"Excel rows: {len(data)}")

ops = []
not_found = []

for row in data:
    plate, repair_budget, pm_oil_cost, annual_pm_cap = row[0], row[1], row[2], row[3]
    if not plate:
        continue
    plate = str(plate).strip()
    contract_code = plate_to_code.get(plate)
    if not contract_code:
        not_found.append(plate)
        continue

    doc = {
        "contractCode":  contract_code,
        "licensePlate":  plate,
        "repairBudget":  float(repair_budget or 0),
        "pmOilCost":     float(pm_oil_cost or 0),
        "annualPmCap":   float(annual_pm_cap or 0),
    }
    ops.append(UpdateOne(
        {"licensePlate": plate},
        {"$set": doc, "$setOnInsert": {"createdAt": __import__("datetime").datetime.utcnow()}},
        upsert=True
    ))

if ops:
    result = db["promo_config"].bulk_write(ops)
    print(f"Upserted: {result.upserted_count}  Modified: {result.modified_count}")
else:
    print("No ops to run")

if not_found:
    print(f"\nNo matching contract for {len(not_found)} plates:")
    for p in not_found[:20]:
        print(f"  {p}")
    if len(not_found) > 20:
        print(f"  ...and {len(not_found)-20} more")

client.close()
print("\nDone.")
