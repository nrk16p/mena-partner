"""
Seed repair_monthly collection from 'รวมค่าซ่อม' sheet.
Stores monthly repair cost breakdown per contract.

Column mapping (data starts row 2, 0-indexed):
  0:  contractCode
  1:  buyerName
  2:  driverName
  3:  truckNumber
  4:  licensePlate
  5:  partsAmount (ค่าอะไหล่)
  6:  tireAmount (ยาง)
  7:  tirePatchAmount (ค่าปะยาง)
  8:  cleaningAmount (ค่าทำความสะอาด)
  9:  outsideRepairAmount (ซ่อมนอก)
  10: managementFee (ค่าดำเนินการ)
  11: laborAmount (ค่าแรง)
  12: totalRepair (ยอดรวม)
  15: liabilityTotal (ยอดรวมรับสภาพหนี้)
  16: liabilityThisMonth (ยอดรับสภาพหนี้เรียกเก็บเดือนนี้ ผ่อน)
  19: debtAcceptanceRepair (รับสภาพหนี้ค่าซ่อม)
  20: debtAcceptancePM (รับสภาพหนี้ PM)
  21: promoRepairAmount (รับโปรค่าซ่อม)
  22: promoMaintenanceAmount (โปร2 ฟรีค่าบำรุงรักษา)
  24: pmTotalPerYear (PM รวม/ปี)
  26: pmUsed (ใช้แล้ว)
  27: pmRemaining (คงเหลือ)

Run: python3 scripts/seed-repair-monthly.py  (from project root)
"""
import openpyxl
from pymongo import MongoClient, UpdateOne
from datetime import datetime, timezone

MONGO_URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME    = "mena_partner"
EXCEL_PATH = "Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx"
MONTH      = "2026-05"  # data is for May 2026

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
now    = datetime.now(timezone.utc)

def to_float(val):
    try:
        return float(str(val).replace(",", "")) if val is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

def clean(val):
    return str(val).strip() if val is not None else ""

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb["รวมค่าซ่อม"]
rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
data = [r for r in rows[2:] if r[0] and str(r[0]).startswith("MT")]
print(f"Rows to process: {len(data)}")

ops = []
for row in data:
    code = clean(row[0])
    doc = {
        "contractCode":           code,
        "month":                  MONTH,
        "driverName":             clean(row[2]),
        "truckNumber":            clean(row[3]),
        "licensePlate":           clean(row[4]),
        "partsAmount":            to_float(row[5]),
        "tireAmount":             to_float(row[6]),
        "tirePatchAmount":        to_float(row[7]),
        "cleaningAmount":         to_float(row[8]),
        "outsideRepairAmount":    to_float(row[9]),
        "managementFee":          to_float(row[10]),
        "laborAmount":            to_float(row[11]),
        "totalRepair":            to_float(row[12]),
        "liabilityTotal":         to_float(row[15]) if len(row) > 15 else 0.0,
        "liabilityThisMonth":     to_float(row[16]) if len(row) > 16 else 0.0,
        "debtAcceptanceRepair":   to_float(row[19]) if len(row) > 19 else 0.0,
        "debtAcceptancePM":       to_float(row[20]) if len(row) > 20 else 0.0,
        "promoRepairAmount":      to_float(row[21]) if len(row) > 21 else 0.0,
        "promoMaintenanceAmount": to_float(row[22]) if len(row) > 22 else 0.0,
        "pmTotalPerYear":         to_float(row[24]) if len(row) > 24 else 0.0,
        "pmUsed":                 to_float(row[26]) if len(row) > 26 else 0.0,
        "pmRemaining":            to_float(row[27]) if len(row) > 27 else 0.0,
        "updatedAt":              now,
    }
    ops.append(UpdateOne(
        {"contractCode": code, "month": MONTH},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True
    ))

if ops:
    r = db["repair_monthly"].bulk_write(ops)
    print(f"Upserted: {r.upserted_count}  Modified: {r.modified_count}")

# Summary
pipeline = [{"$group": {
    "_id": None,
    "totalRepair": {"$sum": "$totalRepair"},
    "totalTires":  {"$sum": "$tireAmount"},
    "totalParts":  {"$sum": "$partsAmount"},
    "nonZero":     {"$sum": {"$cond": [{"$gt": ["$totalRepair", 0]}, 1, 0]}}
}}]
for s in db["repair_monthly"].aggregate(pipeline):
    print(f"\nMonth {MONTH}: total repair ฿{s['totalRepair']:,.2f} | tires ฿{s['totalTires']:,.2f} | parts ฿{s['totalParts']:,.2f} | {s['nonZero']} contracts with repairs")

client.close()
print("\n✓ Done.")
