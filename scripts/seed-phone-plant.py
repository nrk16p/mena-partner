"""
Update contracts + drivers with phone and plant from Summary sheet.

Summary column mapping (0-indexed):
  0: contractCode
  6: phone (เบอร์โทร)
  7: plant (แพล้นท์)

Run: python3 scripts/seed-phone-plant.py  (from project root)
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

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
ws = wb["Summary"]

rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]

contract_ops = []
driver_ops   = []
count = 0

for row in rows:
    code = row[0]
    if not code:
        continue
    code = str(code).strip()
    if not (code.startswith("MTL") or code.startswith("MTM")):
        continue

    phone = str(row[6]).strip() if row[6] is not None else ""
    plant = str(row[7]).strip() if row[7] is not None else ""

    # skip rows where phone looks like a column header
    if phone in ("เบอร์โทร", "phone", ""):
        phone = ""

    update = {}
    if phone:
        update["phone"] = phone
    if plant:
        update["plant"] = plant
    if not update:
        continue

    update["updatedAt"] = now
    contract_ops.append(UpdateOne({"contractCode": code}, {"$set": update}))
    driver_ops.append(UpdateOne({"contractCode": code}, {"$set": {"phone": phone, "plant": plant}}))
    count += 1

print(f"Records to update: {count}")
if contract_ops:
    r1 = db["contracts"].bulk_write(contract_ops)
    print(f"contracts — matched: {r1.matched_count}  modified: {r1.modified_count}")
if driver_ops:
    r2 = db["drivers"].bulk_write(driver_ops)
    print(f"drivers   — matched: {r2.matched_count}  modified: {r2.modified_count}")

client.close()
print("Done.")
