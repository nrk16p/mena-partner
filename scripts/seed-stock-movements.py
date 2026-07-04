# Seed stock_movements (การเคลื่อนไหวของสินค้า) — 13 rows for MR LBMR25120010 / ME008.
# Wipes the collection first so it matches the source data exactly.
from pymongo import MongoClient
from datetime import datetime, timezone

URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB   = "mena_partner"
COLL = "stock_movements"

def d(s):
    """DD/MM/YYYY → YYYY-MM-DD"""
    p = s.strip().split("/")
    return f"{p[2]}-{p[1].zfill(2)}-{p[0].zfill(2)}"

BASE = {
    "pr": "", "po": "", "dd": "", "mr": "LBMR25120010",
    "supplier": "", "apTerm": "", "warehouse": "คลังลาดกระบัง",
    "truckNumber": "ME008", "driverName": "ธานี ไกรทอง", "licensePlate": "สบ.71-1959",
    "serialNo": "", "receiveQty": 0,
}

NOTE_A = """LBMR25120010    ลาดกระบัง    Mix ใหญ่ เอเชีย    ME008    สบ.71-1959
กมล เบิกส่ง อู่  ท.เจริญ"""
SUB_A = "โยก LBPR25110221/71-2027/120/โม่ใหญ่"

NOTE_B = """LBMR25120010    ลาดกระบัง    Mix ใหญ่ เอเชีย    ME008    สบ.71-1959
LBPR25120085/71-1959/ME008/โม่ใหญ่

บริษัท ท.เจริญ ซัพพลาย แอนด์ เซอร์วิส จำกัด"""
SUB_B = """LBPR25120085/71-1959/ME008/โม่ใหญ่

บริษัท ท.เจริญ ซัพพลาย แอนด์ เซอร์วิส จำกัด"""

NOTE_B2 = """LBMR25120010 ลาดกระบัง Mix ใหญ่ เอเชีย ME008 สบ.71-1959
LBPR25120085/71-1959/ME008/โม่ใหญ่

บริษัท ท.เจริญ ซัพพลาย แอนด์ เซอร์วิส จำกัด"""

NOTE_C = """LBMR25120010        ลาดกระบัง    Mix ใหญ่ เอเชีย    ME008    สบ.71-1959
LBPR25120085/71-1959/ME008/โม่ใหญ่

บริษัท ปทุม 2 เซอร์วิส จำกัด"""
SUB_C = """LBPR25120085/71-1959/ME008/โม่ใหญ่

บริษัท ปทุม 2 เซอร์วิส จำกัด"""

DOCS = [
    {**BASE, "date": d("01/12/2025"), "wd": "LBWD25120025", "purpose": "ซ่อม",
     "itemName": "ลูกหมากคันชักขวา R SANY", "itemCode": "LB03SS00485", "itemGroup": "ระบบช่วงล่าง",
     "issueQty": 1.00, "unitCost": 1100.00, "amount": 1100.00, "maxStock": 0.00, "minStock": 0.00,
     "notes": NOTE_A, "subNotes": SUB_A},
    {**BASE, "date": d("01/12/2025"), "wd": "LBWD25120025", "purpose": "ซ่อม",
     "itemName": "ลูกหมากคันชักซ้าย L SANY", "itemCode": "LB03SS00486", "itemGroup": "ระบบช่วงล่าง",
     "issueQty": 1.00, "unitCost": 1100.00, "amount": 1100.00, "maxStock": 0.00, "minStock": 0.00,
     "notes": NOTE_A, "subNotes": SUB_A},
    {**BASE, "date": d("01/12/2025"), "wd": "LBWD25120025", "purpose": "ซ่อม",
     "itemName": "ลูกหมากคันส่ง-ขวา SANY", "itemCode": "LB03SS00495", "itemGroup": "ระบบช่วงล่าง",
     "issueQty": 1.00, "unitCost": 1100.00, "amount": 1100.00, "maxStock": 0.00, "minStock": 0.00,
     "notes": NOTE_A, "subNotes": SUB_A},
    {**BASE, "date": d("01/12/2025"), "wd": "LBWD25120025", "purpose": "ซ่อม",
     "itemName": "ลูกหมากคันส่ง-ซ้าย SANY", "itemCode": "LB03SS00497", "itemGroup": "ระบบช่วงล่าง",
     "issueQty": 1.00, "unitCost": 1100.00, "amount": 1100.00, "maxStock": 0.00, "minStock": 0.00,
     "notes": NOTE_A, "subNotes": SUB_A},
    {**BASE, "date": d("03/12/2025"), "wd": "LBWD25120156", "purpose": "ค่าซ่อม/ค่าอะไหล่รถร่วม",
     "itemName": "น้ำมันเครื่อง #15W40 (STOCK)", "itemCode": "LB10PM00125", "itemGroup": "ระบบบำรุงรักษา",
     "issueQty": 5.00, "unitCost": 62.00, "amount": 310.00, "maxStock": 250.00, "minStock": 50.00,
     "notes": """LBMR25120010        ลาดกระบัง    Mix ใหญ่ เอเชีย    ME008    สบ.71-1959
จีราภรณ์""", "subNotes": ""},
    {**BASE, "date": d("12/12/2025"), "wd": "LBWD25120697", "purpose": "ซ่อม",
     "itemName": "ค่าแรงเปลี่ยนลูกหมากคันชัก คันส่ง", "itemCode": "LB00183", "itemGroup": "ค่าแรง-ระบบช่วงล่าง",
     "issueQty": 1.00, "unitCost": 1200.00, "amount": 1200.00, "maxStock": 1.00, "minStock": 0.00,
     "notes": NOTE_B, "subNotes": SUB_B},
    {**BASE, "date": d("12/12/2025"), "wd": "LBWD25120697", "purpose": "ซ่อม",
     "itemName": "ค่าแรงเปลี่ยนสลัคคานหน้า", "itemCode": "LB00181", "itemGroup": "ค่าแรง-ระบบช่วงล่าง",
     "issueQty": 1.00, "unitCost": 3500.00, "amount": 3500.00, "maxStock": 1.00, "minStock": 0.00,
     "notes": NOTE_B, "subNotes": SUB_B},
    {**BASE, "date": d("12/12/2025"), "wd": "LBWD25120698", "purpose": "ซ่อม",
     "itemName": "กาวทาประเกน", "itemCode": "LB08GP00017", "itemGroup": "วัสดุสิ้นเปลือง",
     "issueQty": 1.00, "unitCost": 40.00, "amount": 40.00, "maxStock": 0.00, "minStock": 0.00,
     "notes": NOTE_B2, "subNotes": SUB_B},
    {**BASE, "date": d("12/12/2025"), "wd": "LBWD25120698", "purpose": "ซ่อม",
     "itemName": "จารบี 2 Kg", "itemCode": "LB08GP00905", "itemGroup": "วัสดุสิ้นเปลือง",
     "issueQty": 1.00, "unitCost": 750.00, "amount": 750.00, "maxStock": 1.00, "minStock": 0.00,
     "notes": NOTE_B2, "subNotes": SUB_B},
    {**BASE, "date": d("12/12/2025"), "wd": "LBWD25120698", "purpose": "ซ่อม",
     "itemName": "น้ำมันก๊าด", "itemCode": "LB08GP00188", "itemGroup": "วัสดุสิ้นเปลือง",
     "issueQty": 1.00, "unitCost": 150.00, "amount": 150.00, "maxStock": 1.00, "minStock": 0.00,
     "notes": NOTE_B2, "subNotes": SUB_B},
    {**BASE, "date": d("12/12/2025"), "wd": "LBWD25120698", "purpose": "ซ่อม",
     "itemName": "ประเก็นหัวดุมล้อหน้า SANY", "itemCode": "LB03SS00849", "itemGroup": "ระบบช่วงล่าง",
     "issueQty": 2.00, "unitCost": 35.00, "amount": 70.00, "maxStock": 0.00, "minStock": 0.00,
     "notes": NOTE_B2, "subNotes": SUB_B},
    {**BASE, "date": d("23/12/2025"), "wd": "LBWD25121504", "purpose": "ค่าซ่อม/ค่าอะไหล่รถร่วม",
     "itemName": "ค่าแรงตั้งศูณย์ถ่วงล้อ", "itemCode": "LB00022", "itemGroup": "ค่าแรง-ระบบช่วงล่าง",
     "issueQty": 1.00, "unitCost": 3000.00, "amount": 3000.00, "maxStock": 1.00, "minStock": 0.00,
     "notes": NOTE_C, "subNotes": SUB_C},
    {**BASE, "date": d("30/12/2025"), "wd": "LBWD25121725", "purpose": "ค่าซ่อม/ค่าอะไหล่รถร่วม",
     "itemName": "ค่าดำเนินการ", "itemCode": "LB00034", "itemGroup": "ค่าแรง",
     "issueQty": 1.00, "unitCost": 1073.60, "amount": 1073.60, "maxStock": 1.00, "minStock": 0.00,
     "notes": "LBDD25121100", "subNotes": "ค่าดำเนินการ 13420+8%=1073.60"},
]

def main():
    client = MongoClient(URI)
    col    = client[DB][COLL]
    now    = datetime.now(timezone.utc)

    deleted = col.delete_many({}).deleted_count
    print(f"deleted old docs: {deleted}")

    for doc in DOCS:
        doc["createdAt"] = now
        doc["updatedAt"] = now
    col.insert_many(DOCS)

    total_amount = sum(x["amount"] for x in DOCS)
    print(f"inserted: {len(DOCS)}  total in collection: {col.count_documents({})}  ยอดเงินรวม: {total_amount:,.2f}")
    client.close()

if __name__ == "__main__":
    main()
