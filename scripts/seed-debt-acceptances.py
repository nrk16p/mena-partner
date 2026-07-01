"""
Seed debt_acceptances collection from รับสภาพหนี้ค่าซ่อม sheet.

Column mapping (0-indexed, data starts row 3):
  0:  startDate (วันที่เริ่มชำระ)  DD/MM/YYYY
  1:  endDate (สิ้นสุดเดือน)       datetime
  2:  issueDate (วันที่ออกรายการ)  DD/MM/YYYY
  3:  debtAcceptanceNo (เลขที่ใบ)
  4:  branch (สาขา)
  6:  empId — either MT code (direct contractCode) or numeric (look up via plate from col[27])
  7:  driverName
  12: repairOrderNo (รายการแจ้งซ่อม)
  14: repairType (รายการอื่นๆ)
  15: fullDamageCost (ค่าเสียหายเต็ม)
  17: depreciation (ค่าเสื่อมราคา)
  18: liabilityAmount (ยอดรับผิด)
  19: installmentCount (จำนวนงวด)
  20: monthlyInstallment (เดือนละ)
  27: description (มีทะเบียนรถฝังอยู่)
  28: status

Run: python3 scripts/seed-debt-acceptances.py  (from project root)
"""
import re
import openpyxl
from pymongo import MongoClient, UpdateOne
from datetime import datetime, timezone

MONGO_URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME    = "mena_partner"
EXCEL_PATH = "Rev.o1 Payroll รถร่วม Mixer มิ.ย. 69.xlsx"

client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
now    = datetime.now(timezone.utc)

# Build lookup maps from contracts
contracts = list(db["contracts"].find({}, {"licensePlate": 1, "contractCode": 1, "_id": 0}))
code_set   = {c["contractCode"] for c in contracts}
plate_map  = {}
for c in contracts:
    plate = c.get("licensePlate", "")
    if plate:
        plate_map[plate] = c["contractCode"]
        # also index without spaces
        plate_map[plate.replace(" ", "")] = c["contractCode"]
print(f"Loaded {len(contracts)} contracts")

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
    if "T" in s or " " in s:
        return s[:10]
    return s

def to_float(val):
    try:
        return float(str(val).replace(",", "")) if val is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

def clean(val):
    return str(val).strip() if val is not None else ""

PLATE_RE = re.compile(r'(?:สบ\.)?(\d{2})-(\d{4,5})')

def extract_plate_from_desc(desc):
    """Extract license plate like สบ.71-1956 from description text."""
    if not desc:
        return None
    # Match สบ.XX-XXXX or XX-XXXX
    m = re.search(r'สบ\.(\d{2}-\d{4,5})', desc)
    if m:
        plate = f"สบ.{m.group(1)}"
        return plate
    m = re.search(r'\b(\d{2}-\d{4,5})\b', desc)
    if m:
        plate = f"สบ.{m.group(1)}"
        return plate
    return None

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb["รับสภาพหนี้ค่าซ่อม"]
rows = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
data = rows[3:]  # skip 3 header rows
print(f"Excel rows to process: {len(data)}")

ops = []
not_linked = []

for row in data:
    doc_no   = clean(row[3])
    if not doc_no:
        continue

    emp_id   = clean(row[6])
    desc     = clean(row[27]) if len(row) > 27 else ""

    # Resolve contractCode
    contract_code = None
    if emp_id in code_set:
        contract_code = emp_id
    elif emp_id.startswith("MT") and "-" in emp_id:
        # variants like MTM116-1
        base = emp_id.split("-")[0]
        if base in code_set:
            contract_code = base

    if not contract_code:
        plate = extract_plate_from_desc(desc)
        if plate:
            contract_code = plate_map.get(plate) or plate_map.get(plate.replace(" ", ""))

    if not contract_code:
        not_linked.append({"debtAcceptanceNo": doc_no, "empId": emp_id, "desc": desc[:60]})

    doc = {
        "debtAcceptanceNo":  doc_no,
        "contractCode":      contract_code or "",
        "driverName":        clean(row[7]),
        "repairOrderNo":     clean(row[12]) if len(row) > 12 else "",
        "repairType":        clean(row[14]) if len(row) > 14 else "",
        "issueDate":         parse_date(row[2]),
        "startDate":         parse_date(row[0]),
        "endDate":           parse_date(row[1]),
        "branch":            clean(row[4]),
        "fullDamageCost":    to_float(row[15]) if len(row) > 15 else 0.0,
        "depreciation":      to_float(row[17]) if len(row) > 17 else 0.0,
        "liabilityAmount":   to_float(row[18]) if len(row) > 18 else 0.0,
        "installmentCount":  int(to_float(row[19])) if len(row) > 19 and row[19] else 0,
        "monthlyInstallment": to_float(row[20]) if len(row) > 20 else 0.0,
        "description":       desc,
        "status":            clean(row[28]) if len(row) > 28 else "",
        "updatedAt":         now,
    }

    ops.append(UpdateOne(
        {"debtAcceptanceNo": doc_no},
        {"$set": doc, "$setOnInsert": {"createdAt": now}},
        upsert=True
    ))

if ops:
    result = db["debt_acceptances"].bulk_write(ops)
    print(f"Upserted: {result.upserted_count}  Modified: {result.modified_count}")

linked = len(ops) - len(not_linked)
print(f"\nLinked to contract: {linked}/{len(ops)}")
if not_linked:
    print(f"Not linked ({len(not_linked)}):")
    for x in not_linked[:10]:
        print(f"  {x['debtAcceptanceNo']} | emp={x['empId']} | {x['desc']}")

# Summary by type
pipeline = [{"$group": {"_id": "$repairType", "count": {"$sum": 1}, "total": {"$sum": "$liabilityAmount"}}}]
print("\nBy repair type:")
for r in db["debt_acceptances"].aggregate(pipeline):
    print(f"  {r['_id']}: {r['count']} records, ฿{r['total']:,.2f}")

client.close()
print("\n✓ Done.")
