"""
Update contracts collection with full details from สรุปค่างวด sheet.

Columns (header row 2, data from row 3):
  0: contractCode  1: buyerName  2: licensePlate  3: accountNumber
  4: plant(ศูนย์)  5: vehicleBrand  6: contractDate  7: startDate
  8: totalPrice    9: downPayment  11: totalInstallments  12: monthlyInstallment
"""
import openpyxl
from pymongo import MongoClient, UpdateOne
from datetime import datetime, timezone

MONGO_URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME    = "mena_partner"
EXCEL_PATH = "Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx"
SHEET_NAME = "สรุปค่างวด"

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]

wb   = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
ws   = wb[SHEET_NAME]
rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]

# row index 1 = header, data starts at index 2
data = rows[2:]
print(f"Data rows: {len(data)}")

def to_dt(val):
    """Convert openpyxl datetime or None → Python datetime (UTC-aware) or None."""
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc)
    return None

def clean_str(val):
    return str(val).strip() if val is not None else ""

ops = []
skipped = []

for row in data:
    code = row[0]
    if not code or not str(code).strip():
        continue
    code = str(code).strip()
    if not (code.startswith("MTL") or code.startswith("MTM")):
        continue

    update = {
        "buyerName":          clean_str(row[1]),
        "licensePlate":       clean_str(row[2]),
        "accountNumber":      clean_str(row[3]),
        "plant":              clean_str(row[4]),
        "vehicleBrand":       clean_str(row[5]),
        "totalPrice":         float(row[8] or 0),
        "downPayment":        float(row[9] or 0),
        "totalInstallments":  int(row[11] or 0),
        "monthlyInstallment": float(row[12] or 0),
        "updatedAt":          datetime.now(timezone.utc),
    }

    dt_contract = to_dt(row[6])
    dt_start    = to_dt(row[7])
    if dt_contract:
        update["contractDate"] = dt_contract
    if dt_start:
        update["startDate"] = dt_start

    ops.append(UpdateOne(
        {"contractCode": code},
        {"$set": update},
        upsert=False   # only update existing contracts
    ))

if ops:
    result = db["contracts"].bulk_write(ops)
    print(f"Matched: {result.matched_count}  Modified: {result.modified_count}")
else:
    print("No ops")

if skipped:
    print(f"Skipped {len(skipped)} rows (no MTL code)")

client.close()
print("Done.")
