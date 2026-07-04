# Seed debt_acceptances with the 10 ใบรับสภาพหนี้ records (mock data from Excel).
# Wipes the collection first so it matches the source data exactly.
from pymongo import MongoClient
from datetime import datetime, timezone

URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB   = "mena_partner"
COLL = "debt_acceptances"

def d(s):
    """DD/MM/YYYY → YYYY-MM-DD"""
    if not s: return ""
    p = s.strip().split("/")
    return f"{p[2]}-{p[1].zfill(2)}-{p[0].zfill(2)}" if len(p) == 3 else s

BASE = {
    "driverStatus": "พจร", "vehicleType": "รถร่วมมีนา", "driverAffiliation": "ลาดกระบัง",
    "accidentOrderNo": "", "depreciationPeriod": "", "depreciationAmount": 0.0,
    "actualPayDate": "", "totalPaid": 0, "paymentMethod": "",
    "status": "ค้างผ่อนชำระ",
    "contractCode": "", "matched": False, "matchedBy": "none",
}

DOCS = [
    {
        **BASE,
        "issueDate": d("11/07/2025"), "debtAcceptanceNo": "LBAD25070058",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "190409", "employeeName": "กัญจน์ พรมมะ",
        "repairOrderNo": "LBMR25070188", "otherItems": "ค่าอะไหล่รถร่วม", "repairType": "repair",
        "fullDamageAmount": 78192.00, "liabilityAmount": 78192.00,
        "installmentCount": 15, "monthlyInstallment": 5212.80,
        "startDate": d("31/08/2025"), "endDate": d("01/12/2026"),
        "outstandingBalance": 78192.00,
        "description": """พจร.ขับรถทะเบียน สบ.70-6291/ME141 แจ้งซ่อมฐานรับโม่ด้านท้ายทรุด ขารับรางวีซ้ายขวาผุ มีค่าใช้จ่ายในการซ่อม 78192 บาท

-ค่าแรงเชื่อมฐานรับโม่เหล็ก 6 มิลพร้อมทำสี  ค่าแรงเชื่อมขารับรางวี ซ้าย ขวาเหล็ก 6 มิล พร้อมทำสี  40200
-ค่าแรงเชื่อมรางวี พร้อมทำสี 6000
- ค่าแรงถอดแท่นรับโม่และประกอบ 15000
- รางวี  7400
-สาแหรกยึดฐานโม่(สั้น) 950*4=3800
ค่าดำเนินการ 72400+8%=5792""",
        "paymentNotes": "",
        "licensePlate": "70-6291", "truckNumber": "ME141",
    },
    {
        **BASE,
        "issueDate": d("20/08/2025"), "debtAcceptanceNo": "LBAD25080083",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "140036", "employeeName": "เลียว นุชกลาง",
        "repairOrderNo": "LBMR25080596", "otherItems": "ค่าอะไหล่รถร่วม", "repairType": "repair",
        "fullDamageAmount": 83160.00, "liabilityAmount": 83160.00,
        "installmentCount": 12, "monthlyInstallment": 6930.00,
        "startDate": d("30/09/2025"), "endDate": d("30/09/2026"),
        "outstandingBalance": 83160.00,
        "description": """พจร.ขับรถ ME118 สบ.71-8632 แจ้งซ่อม คานรับฐานตัวท้ายผุ / เหล็กยึดบันไดขาด / น๊อตล้อข้างซ้าย 1 ชุด  มีค่าใช้จ่าย 83160 บาท
- รางวี 7000
-  ค่าแรงซ่อมแชสซีฐานโม่ คานรับโม่ ฐานรับราง 3000
-ค่าแรงตัดฐานรับโม่พร้อมติดตั้ง     42700
-ค่าแรงติดตั้งและเปลี่ยนรางวี 5000
-ค่าแรงเชื่อมบันไดขึ้นโม่    3000
-น็อตล้อหลังซ้ายทั้งชุด     600
- สกรู M20 x 6.5 น๊อต+แหวนสปริง(เกลียวหยาบ) 8*200=1600
- สาแหรกยาว M20 9559-706(ชุดสาแหรกยึดคัทซีโม่หลัง)     800*4=3200
- เพลท 6 มิล 10x1600  1 ชิ้น 2500
-ค่าแรงซ่อมฐานโม่ทำขารับรางวี ตัดเก่าออก+ประกอบใหม่  8000
-ลูกยางหูโช๊คล่าง UD  100*4=400
ค่าดำเนินการในการซ่อม 6160""",
        "paymentNotes": "",
        "licensePlate": "71-8632", "truckNumber": "ME118",
    },
    {
        **BASE,
        "issueDate": d("23/10/2025"), "debtAcceptanceNo": "KKAD25100001",
        "branch": "ขอนแก่น", "department": "ยานยนต์ (ศขก)",
        "employeeCode": "MTM118", "employeeName": "ชาติชาย แก้วลือ",
        "repairOrderNo": "KKMR25100005", "otherItems": "ค่าใช่จ่ายเรื่องยาง", "repairType": "tire",
        "fullDamageAmount": 36849.69, "liabilityAmount": 36849.69,
        "installmentCount": 8, "monthlyInstallment": 4606.21,
        "startDate": d("30/11/2025"), "endDate": d("30/07/2026"),
        "outstandingBalance": 36849.69,
        "description": """พจร.ขับรถทะเบียน สบ.71-3820 / NL32
ยางผ้าใบดอกบั้ง 1000-20 ราคา 4196.26*8เส้น เป็นเงิน 33570.09.-บาท
ยางใน 900-20 ราคา 550.-บาท
ค่าดำเนินการ 8% เป็นเงิน 2729.60.-บาท
รวม 36,849.69.-บาท""",
        "paymentNotes": "พจร.จองยางra1-8",
        "licensePlate": "71-3820", "truckNumber": "NL32",
    },
    {
        **BASE,
        "issueDate": d("30/11/2025"), "debtAcceptanceNo": "LBAD25110289",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "190409", "employeeName": "กัญจน์ พรมมะ",
        "repairOrderNo": "LBMR25100694", "otherItems": "ค่าใช่จ่ายเรื่องยาง", "repairType": "tire",
        "fullDamageAmount": 37426.12, "liabilityAmount": 37426.12,
        "installmentCount": 20, "monthlyInstallment": 1871.31,
        "startDate": d("31/12/2025"), "endDate": d("31/08/2027"),
        "outstandingBalance": 37426.12,
        "description": """พจร.ขับรถทะเบียน 70-6291 เบอร์ ME141
ยางผ้าใบดอกบั้ง 1000-20 ราคา 4196.26*7เส้น เป็นเงิน 29,373.82.-บาท
ยางผ้าใบดอกบั้ง 1000-20 ราคา 4250.-บาท
ยางใน 900-20 ราคา 515*2เส้น เป็นเงิน 1,030.-บาท
ค่าดำเนินการ 8% ราคา 2772.30.-บาท
รวมเป็นเงิน 37,426.12.-บาท""",
        "paymentNotes": "พจร.จองยางra1-8",
        "licensePlate": "70-6291", "truckNumber": "ME141",
    },
    {
        **BASE,
        "issueDate": d("30/11/2025"), "debtAcceptanceNo": "LBAD25110297",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "MTM121", "employeeName": "สฤษฏ์ จำปาแก้ว",
        "repairOrderNo": "LBMR25100232", "otherItems": "ค่าใช่จ่ายเรื่องยาง", "repairType": "tire",
        "fullDamageAmount": 37600.20, "liabilityAmount": 37600.20,
        "installmentCount": 8, "monthlyInstallment": 4700.03,
        "startDate": d("31/12/2025"), "endDate": d("31/08/2026"),
        "outstandingBalance": 37600.20,
        "description": """พจร.ขับรถทะเบียน 71-3566 เบอร์ ME050
ยางผ้าใบดอกสร้อย 1000-20 ราคา 4250*2เส้น เป็นเงิน 8,500.-บาท
ยางผ้าใบดอกบั้ง 1000-20 ราคา 4250*4เส้น เป็นเงิน 17,000.-บาท
ยางใน 900-20 ราคา 515.-บาท
ยางรองคอ 900-20 ราคา 150*2เส้น เป็นเงิน 300.-บาท
ค่าดำเนินการ 80% ราคา 2785.20.-บาท
รวมเป็นเงินทั้งสิ้น 37,600.20.-บาท""",
        "paymentNotes": "พจร.จองยางf12/ra123478",
        "licensePlate": "71-3566", "truckNumber": "ME050",
    },
    {
        **BASE,
        "issueDate": d("19/12/2025"), "debtAcceptanceNo": "LBAD25120069",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "190401", "employeeName": "ธานี ไกรทอง",
        "repairOrderNo": "LBMR25120010", "otherItems": "ค่าอะไหล่รถร่วม", "repairType": "repair",
        "fullDamageAmount": 14493.60, "liabilityAmount": 14493.60,
        "installmentCount": 8, "monthlyInstallment": 1811.70,
        "startDate": d("31/01/2026"), "endDate": d("01/10/2026"),
        "outstandingBalance": 14493.60,
        "description": """พจร.ขับรถ 71-1959 / ME008 แจ้งซ่อม *คันชักคันส่งหลวม คอม้าหลวม มีรายการซ่อม
-ลูกหมากคันชักขวา R SANY  1100
- ลูกหมากคันชักซ้าย L SANY    1100
-ลูกหมากคันส่ง-ขวา SANY    1100
- ลูกหมากคันส่ง-ซ้าย SANY 1100
-น้ำมันเครื่อง #15W40 (STOCK) 62*5=310
ค่าแรงเปลี่ยนลูกหมากคันชัก คันส่ง  1200
ค่าแรงเปลี่ยนสลัคคานหน้า     3500
- กาวทาประเกน     40
- จารบี 2 Kg 750
-น้ำมันก๊าด 150
- ประเก็นหัวดุมล้อหน้า SANY     35*2=70
ค่าแรงตั้งศูณย์ถ่วงล้อ  3000
ค่าดำเนินการ 1073.6
ยอดรวมค่าใช้จ่าย  14,493.6 บาท""",
        "paymentNotes": "",
        "licensePlate": "71-1959", "truckNumber": "ME008",
    },
    {
        **BASE,
        "issueDate": d("19/12/2025"), "debtAcceptanceNo": "LBAD25120071",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "190401", "employeeName": "ธานี ไกรทอง",
        "repairOrderNo": "LBMR25120343", "otherItems": "ค่าอะไหล่รถร่วม", "repairType": "repair",
        "fullDamageAmount": 23868.00, "liabilityAmount": 23868.00,
        "installmentCount": 8, "monthlyInstallment": 2983.50,
        "startDate": d("31/01/2026"), "endDate": d("01/10/2026"),
        "outstandingBalance": 23868.00,
        "description": """พจร.ขับรถ 71-1959 / ME008 แจ้งซ่อมกระจกประตูด้านขวากดขึ้นลงไม่ได้  แหนบหน้าซ้าย หัก2ต้ว ( แผ่นที่ 4 และ5 นับ จากล่าง )  มีค่าใช้จ่าย  23868 บาท
 -บูธหูแหนบหน้า (ตัวหลัง) SANY    180
-สลักหูแหนบหน้า SANY 230*4=920
- สาแหรก 10 นิ้ว 500*2=1000
-แหนบหน้า ซ้าย-ขวา (ยกตับ) SANY  14500
ค่าแรงเปลี่ยนแหนบหน้า 3000
ชุดเฟืองกระจก 2500
รวมค่าซ่อม+อะไหล่  22100
ค่าดำเนินการ 8%=1768""",
        "paymentNotes": "",
        "licensePlate": "71-1959", "truckNumber": "ME008",
    },
    {
        **BASE,
        "issueDate": d("22/12/2025"), "debtAcceptanceNo": "LBAD25120086",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "190151", "employeeName": "สุริยัน มะโฮงชัย",
        "repairOrderNo": "LBMR25120422", "otherItems": "ค่าใช่จ่ายเรื่องยาง", "repairType": "tire",
        "fullDamageAmount": 29689.20, "liabilityAmount": 29689.20,
        "installmentCount": 6, "monthlyInstallment": 4948.20,
        "startDate": d("31/01/2026"), "endDate": d("31/07/2026"),
        "outstandingBalance": 29689.20,
        "description": """พจร.ขับรถทะเบียน สบ.71-8630 / ME604
ยางผ้าใบดอกบั้ง 1000-20 ราคา 4250*6เส้น เป็นเงิน 25500.-บาท
ยางใน 900-20 ราคา 530.-บาท
ยางรองคอ 900-20 ราคา 280*2เส้น เป็นเงิน 560.-บาท
คิ้วกะทะล้อ 7.00*20 (8รู10รู) ราคา 450*2วง เป็นเงิน 900.-บาท
ค่าดำเนินการ 8% เป็นเงิน 2199.20.-บาท
รวม 29,689.20.-บาท""",
        "paymentNotes": "พจร.จองยายง ra3-8",
        "licensePlate": "71-8630", "truckNumber": "ME604",
    },
    {
        **BASE,
        "issueDate": d("31/01/2026"), "debtAcceptanceNo": "LBAD26010182",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "MTM093", "employeeName": "วิโรจน์ อัดจันทึก",
        "repairOrderNo": "LBMR26010475", "otherItems": "ค่าใช่จ่ายเรื่องยาง", "repairType": "tire",
        "fullDamageAmount": 32408.17, "liabilityAmount": 32408.17,
        "installmentCount": 6, "monthlyInstallment": 5401.36,
        "startDate": d("28/02/2026"), "endDate": d("28/08/2026"),
        "outstandingBalance": 32408.17,
        "description": """พจร.ขับรถทะเบียน 71-5051 เบอร์ 1525
ยางดอกสร้อย1000-20ราคา 4196.26*2 = 8,392.53 บาท
ยางดอกบั้ง1000-20ราคา 4196.26*4 = 16,785.04 บาท
ยางใน900-20ราคา 515*6 = 3,090 บาท
ยางรองคอ900-20ราคา 150*6 = 900 บาท
ค่าเปลี่ยนยางราคา 140*6 = 840 บาท
ค่าดำเนินการ8%ราคา 2400.60 บาท
รวมเป็นเงิน 32,408.17.-บาท""",
        "paymentNotes": "พจร.จองยางf12/ra1-4",
        "licensePlate": "71-5051", "truckNumber": "1525",
    },
    {
        **BASE,
        "issueDate": d("31/01/2026"), "debtAcceptanceNo": "LBAD26010183",
        "branch": "ลาดกระบัง", "department": "ยานยนต์ (ศลบ)",
        "employeeCode": "180226", "employeeName": "นภดล เย็นเจริญ",
        "repairOrderNo": "LBMR26010630", "otherItems": "ค่าใช่จ่ายเรื่องยาง", "repairType": "tire",
        "fullDamageAmount": 29405.77, "liabilityAmount": 29405.77,
        "installmentCount": 6, "monthlyInstallment": 4900.96,
        "startDate": d("28/02/2026"), "endDate": d("28/08/2026"),
        "outstandingBalance": 29405.77,
        "description": """พจร.ขับรถทะเบียน 70-6309 ME102
ยางดอกสร้อย 1000-20 ราคา 4196.26*2 = 8,392.53 บาท
ยางดอกบั้ง 1000-20 ราคา 4196.26*4 = 16,785.04 บาท
ยางรองคอ900-20 ราคา 150*2 = 300 บาท
ยางใน900-20 ราคา 515*2 = 1,030 บาท
ค่าเปลี่ยนยางราคา 120*6 = 720  บาท
ค่าดำเนินการ8%ราคา 2178.20 บาท
รวมเป็นเงิน 29,405.77.-บาท""",
        "paymentNotes": "พจร.จองยางf12/ra1-4",
        "licensePlate": "70-6309", "truckNumber": "ME102",
    },
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
    print(f"inserted: {len(DOCS)}  total in collection: {col.count_documents({})}")
    client.close()

if __name__ == "__main__":
    main()
