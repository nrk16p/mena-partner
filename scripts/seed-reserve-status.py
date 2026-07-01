"""
Seed reserve/overdue status from 'เบิกสำรอง' sheet.
Updates contracts with overdue installment data and reserve balance.

Column mapping (data starts row 4, 0-indexed):
  0:  contractCode
  1:  buyerName
  2:  driverName
  3:  licensePlate
  4:  bankAccount
  5:  phone
  6:  contractStartDate
  7:  plant
  8:  dueInstallmentNo (งวดที่ถึงดิว)
  9:  overdueCount (จำนวนงวดที่ค้าง)
  10: overdueAmount (ค่างวดที่ค้าง บาท)
  11: otherDebtBalance (ลูกหนี้คงค้างยกไป อื่นๆ)
  12: repairReserve (สำรองอื่นๆ ผ่อนชำระค่าซ่อม)
  13: installmentReserve (สำรองอื่นๆ ผ่อนชำระค่างวด)
  14: totalReserveBalance (รวม)
  16: netPayLastMonth (รายได้รับสุทธิ พค 69)
  17: emergencyDraw (เบิกฉุกเฉิน)
  18: reserveDraw (เบิกสำรอง)
  27: note (หมายเหตุ)
  28: drawLimit (วงเงินเบิก)

Run: python3 scripts/seed-reserve-status.py  (from project root)
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

def to_float(val):
    try:
        return float(str(val).replace(",", "")) if val is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

def to_int(val):
    try:
        return int(float(str(val))) if val is not None else 0
    except (TypeError, ValueError):
        return 0

def clean(val):
    return str(val).strip() if val is not None else ""

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb["เบิกสำรอง"]
rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
data = [r for r in rows[4:] if r[0] and str(r[0]).startswith("MT")]
print(f"Rows to process: {len(data)}")

ops = []
for row in data:
    code = clean(row[0])
    update = {
        "dueInstallmentNo":   to_int(row[8]),
        "overdueCount":       to_int(row[9]),
        "overdueAmount":      to_float(row[10]),
        "otherDebtBalance":   to_float(row[11]),
        "repairReserve":      to_float(row[12]) if len(row) > 12 else 0.0,
        "installmentReserve": to_float(row[13]) if len(row) > 13 else 0.0,
        "totalReserveBalance":to_float(row[14]) if len(row) > 14 else 0.0,
        "netPayLastMonth":    to_float(row[16]) if len(row) > 16 else 0.0,
        "emergencyDraw":      to_float(row[17]) if len(row) > 17 else 0.0,
        "reserveDraw":        to_float(row[18]) if len(row) > 18 else 0.0,
        "reserveNote":        clean(row[27]) if len(row) > 27 else "",
        "drawLimit":          to_float(row[28]) if len(row) > 28 else 0.0,
        "reserveAsOfMonth":   "2026-05",
        "updatedAt":          now,
    }
    ops.append(UpdateOne({"contractCode": code}, {"$set": update}))

if ops:
    r = db["contracts"].bulk_write(ops)
    print(f"Matched: {r.matched_count}  Modified: {r.modified_count}")

# Summary: overdue contracts
overdue = list(db["contracts"].find(
    {"overdueCount": {"$gt": 0}},
    {"contractCode": 1, "overdueCount": 1, "overdueAmount": 1, "totalReserveBalance": 1, "_id": 0}
).sort("overdueCount", -1).limit(10))
print(f"\nContracts with overdue installments ({len(overdue)} found):")
for c in overdue:
    print(f"  {c['contractCode']} — {c['overdueCount']} งวด | ค้าง ฿{c['overdueAmount']:,.0f} | สำรองรวม ฿{c.get('totalReserveBalance',0):,.0f}")

client.close()
print("\n✓ Done.")
