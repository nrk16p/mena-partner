"""
Seed gps_config collection from 'GPS' sheet.
Links each GPS device to a contractCode via truckNumber (col[6] = ME008 etc.).

Column mapping (0-indexed, data row = licensePlate in col[0]):
  0:  licensePlate (ทะเบียน format: สบ.71-xxxx)
  2:  accContractNo (เลขสัญญา — old ACC/YYYY/NNN format, not MT code)
  4:  vendor (Vender)
  5:  installDate
  6:  truckNumber (เบอร์รถ — ME008, ME009 etc.)
  7:  boxNumber (เลขที่กล่อง)
  8:  chassisNumber (หมายเลขตัวถัง)
  9:  startDate (วันที่เริ่ม)
 10:  fleet (ฟลีท)
 11:  plant (แพลนท์)
 12:  monthlyFee (ค่าบริการ)

Run: python3 scripts/seed-gps-config.py  (from project root)
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
ws = wb["GPS"]

rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
data = [r for r in rows if r[6] and str(r[6]).strip().startswith("ME")]
print(f"GPS rows with ME codes: {len(data)}")

# Build truckNumber → contractCode map from contracts collection
contracts = list(db["contracts"].find({}, {"contractCode": 1, "truckNumber": 1, "_id": 0}))
truck_to_contract = {c["truckNumber"]: c["contractCode"] for c in contracts if c.get("truckNumber")}
print(f"Contracts with truckNumber: {len(truck_to_contract)}")

def clean(v):
    return str(v).strip() if v is not None else ""

def to_float(v):
    try:
        return float(str(v).replace(",", "")) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

def to_date(v):
    if v is None:
        return None
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    return s[:10] if len(s) >= 10 else s

ops = []
unmatched = []

for row in data:
    truck_num   = clean(row[6])
    contract_code = truck_to_contract.get(truck_num)
    if not contract_code:
        unmatched.append(truck_num)
        continue

    doc = {
        "contractCode":  contract_code,
        "truckNumber":   truck_num,
        "licensePlate":  clean(row[0]),
        "vendor":        clean(row[4]),
        "installDate":   to_date(row[5]),
        "boxNumber":     clean(row[7]),
        "chassisNumber": clean(row[8]),
        "startDate":     to_date(row[9]),
        "fleet":         clean(row[10]),
        "plant":         clean(row[11]),
        "monthlyFee":    to_float(row[12]),
        "updatedAt":     now,
    }
    ops.append(UpdateOne(
        {"contractCode": contract_code},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True
    ))

print(f"Ops to upsert: {len(ops)}")
if ops:
    r = db["gps_config"].bulk_write(ops)
    print(f"Upserted: {r.upserted_count}  Modified: {r.modified_count}")

if unmatched:
    print(f"Unmatched truckNumbers: {unmatched}")

client.close()
print("Done.")
