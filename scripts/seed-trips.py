"""
Seed trips collection from รายเที่ยว sheet for month 2026-05.

Column mapping (0-indexed):
  0:  date (ออก LDT) — format "DD/MM/YYYY" → convert to "YYYY-MM-DD"
  1:  serviceType (บริการ)
  2:  ldtNumber (LDT)
  3:  plant (แพล้นท์)
  4:  routeCode (Route/Ship To)
  7:  destinationName (ชื่อshipto)
  8:  district (อำเภอ)
  9:  province (จังหวัด)
  10: zone (โซน)
  24: licensePlate (หัว) — used to look up contractCode
  49: tripFee (ค่าเที่ยว พจส 1)

Run: python3 scripts/seed-trips.py  (from project root)
"""
import openpyxl
from pymongo import MongoClient, InsertOne
from datetime import datetime, timezone

MONGO_URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME    = "mena_partner"
EXCEL_PATH = "Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx"

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
now    = datetime.now(timezone.utc)

# Build licensePlate → contractCode map
contracts = list(db["contracts"].find({}, {"licensePlate": 1, "contractCode": 1, "_id": 0}))
plate_to_code = {c["licensePlate"]: c["contractCode"] for c in contracts if c.get("licensePlate")}
print(f"Loaded {len(plate_to_code)} contracts for plate lookup")

def parse_date(val):
    """Convert "DD/MM/YYYY" or Excel date to "YYYY-MM-DD"."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 3:
            d, m, y = parts[0].zfill(2), parts[1].zfill(2), parts[2]
            return f"{y}-{m}-{d}"
    return s

def clean(val, default=""):
    return str(val).strip() if val is not None else default

def to_float(val):
    try:
        return float(val) if val is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
ws = wb["รายเที่ยว"]

rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
print(f"Non-empty rows in รายเที่ยว: {len(rows)}")

# Clear existing trips for the month to allow re-seeding
db["trips"].delete_many({"date": {"$gte": "2026-05-01", "$lt": "2026-06-01"}})
print("Cleared existing trips for 2026-05")

ops = []
no_plate = 0
no_contract = []
no_date = 0

for row in rows:
    # Skip header rows — detect by checking if col0 looks like a date
    date_str = parse_date(row[0])
    if not date_str or not date_str.startswith("202"):
        continue

    plate = clean(row[24]) if len(row) > 24 else ""
    if not plate:
        no_plate += 1
        continue

    code = plate_to_code.get(plate)
    if not code:
        # Try stripping spaces and retrying
        plate_stripped = plate.replace(" ", "")
        code = next((v for k, v in plate_to_code.items() if k.replace(" ", "") == plate_stripped), None)
    if not code:
        no_contract.append(plate)
        continue

    trip_fee = to_float(row[49]) if len(row) > 49 else 0.0

    doc = {
        "contractCode":   code,
        "date":           date_str,
        "ldtNumber":      clean(row[2]) if len(row) > 2 else "",
        "plant":          clean(row[3]) if len(row) > 3 else "",
        "serviceType":    clean(row[1]) if len(row) > 1 else "",
        "routeCode":      clean(row[4]) if len(row) > 4 else "",
        "destinationName": clean(row[7]) if len(row) > 7 else "",
        "district":       clean(row[8]) if len(row) > 8 else "",
        "province":       clean(row[9]) if len(row) > 9 else "",
        "zone":           clean(row[10]) if len(row) > 10 else "",
        "tripFee":        trip_fee,
        "createdAt":      now,
    }
    ops.append(InsertOne(doc))

print(f"Trips to insert: {len(ops)}")
print(f"Rows skipped — no plate: {no_plate}")

unique_missing = list(set(no_contract))
print(f"Rows skipped — plate not in contracts: {len(no_contract)} ({len(unique_missing)} unique plates)")
if unique_missing[:10]:
    print(f"  e.g. {unique_missing[:10]}")

if ops:
    BATCH = 1000
    inserted = 0
    for i in range(0, len(ops), BATCH):
        result = db["trips"].bulk_write(ops[i:i+BATCH])
        inserted += result.inserted_count
        print(f"  Inserted batch {i//BATCH + 1}: {result.inserted_count}")
    print(f"Total inserted: {inserted}")

client.close()
print("Done.")
