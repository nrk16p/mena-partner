"""Generate templates/sale.docx from the original sale .docx by inserting
{placeholders} in place of the specimen (ขวัญชัย 71-2820 / MTM145) values.

Usage: python3 scripts/docx-templates/prep_sale.py <src.docx> <out.docx>
"""
import sys
from prep_lib import build_template

V = "ผู้ขายตกลงขาย และผู้ซื้อตกลงซื้อ"  # anchor for the vehicle paragraph (ข้อ 1)

DOC_RULES = [
    # ── header ──
    {"anchor": "เลขสัญญา", "find": "MTM145", "repl": "{contractCode}"},
    {"anchor": "วันที่ 1 เดือน",
     "re": r"วันที่ 1 เดือน เมษายน\s+พ\.ศ\. 2569",
     "repl": "วันที่ {contractDay} เดือน {contractMonth}  พ.ศ. {contractYearBE}"},

    # ── parties ──
    {"anchor": "นาย ขวัญชัย", "find": "นาย ขวัญชัย แสนกันยา อายุ 49 ปี",
     "repl": "{buyerName} อายุ {age} ปี"},
    {"anchor": "ประจำตัวประชาชน", "find": "หมายเลขประจำตัวประชาชน 3 7301 00685 00 3",
     "repl": "หมายเลขประจำตัวประชาชน {nationalId}"},
    {"anchor": "อยู่บ้าน",
     "find": "เลขที่ 14/2 หมู่ที่ 6 ตำบล ทุ่งน้อย อำเภอ เมืองนครปฐม จังหวัด นครปฐม",
     "repl": "เลขที่ {driverAddress}"},

    # ── ข้อ 1: vehicle (all in one paragraph) ──
    {"anchor": V, "find": "ประเภท รถบรรทุกไม่ประจำทาง", "repl": "ประเภท {vehicleType}"},
    {"anchor": V, "find": "ลักษณะ/มาตรฐาน บรรทุกเฉพาะกิจ (คอนกรีตผสมเหลว)",
     "repl": "ลักษณะ/มาตรฐาน {vehicleCharacteristic}"},
    {"anchor": V, "find": "ยี่ห้อ ISUZU", "repl": "ยี่ห้อ {vehicleBrand}"},
    {"anchor": V, "find": "รุ่น FXZ77NXFXQ", "repl": "รุ่น {vehicleModel}"},
    {"anchor": V, "find": "วันจดทะเบียน 17 ตุลาคม 2556", "repl": "วันจดทะเบียน {vehicleRegistrationDate}"},
    {"anchor": V, "find": "สี ขาวเหลือง", "repl": "สี {vehicleColor}"},
    {"anchor": V, "find": "เลขทะเบียน 71-2820", "repl": "เลขทะเบียน {licensePlate}"},
    {"anchor": V, "find": "หมายเลขตัวรถ MP1FXZ77NDT000032", "repl": "หมายเลขตัวรถ {chassisNumber}"},
    {"anchor": V, "find": "หมายเลขเครื่องยนต์ 6UZ1470033", "repl": "หมายเลขเครื่องยนต์ {engineNumber}"},
    {"anchor": V, "find": "ขนาดกำลังเครื่องยนต์ จำนวน 6 สูบ 360 แรงม้า 3 เพลา 6 ล้อ ยาง 10 เส้น",
     "repl": "ขนาดกำลังเครื่องยนต์ {engineSize}"},
    {"anchor": "ระยะทางที่ได้ใช้แล้ว", "re": r"ระยะทางที่ได้ใช้แล้ว[.\-]*",
     "repl": "ระยะทางที่ได้ใช้แล้ว {mileage}"},

    # ── ข้อ 2: price / payments ──
    {"anchor": "ในราคา",
     "find": "ในราคา 1,751,712 บาท (หนึ่งล้านเจ็ดแสนห้าหมื่นหนึ่งพันเจ็ดร้อยสิบสองบาทถ้วน)",
     "repl": "ในราคา {totalPrice} บาท ({totalPriceText})"},
    {"anchor": "ส่วนที่ 1", "find": "จำนวน 100,000 บาท (หนึ่งแสนบาทถ้วน)",
     "repl": "จำนวน {downPayment} บาท ({downPaymentText})"},
    {"anchor": "ชำระมาแล้ว", "find": "ชำระมาแล้ว จำนวน 20,000 บาท (สองหมื่นบาทถ้วน)",
     "repl": "ชำระมาแล้ว จำนวน {cashDown} บาท ({cashDownText})"},
    {"anchor": "ยอดคงเหลือ", "find": "ยอดคงเหลือ 80,000 บาท (แปดหมื่นบาทถ้วน)",
     "repl": "ยอดคงเหลือ {downRemaining} บาท ({downRemainingText})"},
    {"anchor": "เป็นงวด ๆ ละ",
     "find": "เป็นงวด ๆ ละ 2,222.22 บาท (สองพันสองร้อยยี่สิบสองบาทยี่สิบสองสตางค์)",
     "repl": "เป็นงวด ๆ ละ {downInstallmentAmt} บาท ({downInstallmentAmtText})"},
    {"anchor": "เป็นระยะเวลา", "find": "ภายในวันที่ 30 ของทุกเดือน เป็นระยะเวลา 36 เดือน",
     "repl": "ภายใน{payDueText} เป็นระยะเวลา {downInstallmentCount} เดือน"},
    {"anchor": "โดยเริ่มชำระงวดแรก", "find": "โดยเริ่มชำระงวดแรกในวันที่ 31 พฤษภาคม 2569",
     "repl": "โดยเริ่มชำระงวดแรกในวันที่ {firstPayDate}"},
    {"anchor": "ส่วนที่ 2",
     "find": "ส่วนที่ 2 จำนวน 1,651,712 บาท (หนึ่งล้านหกแสนห้าหมื่นหนึ่งพันเจ็ดร้อยสิบสองบาทถ้วน)",
     "repl": "ส่วนที่ 2 จำนวน {financeAmount} บาท ({financeAmountText})"},
    {"anchor": "ภายในกำหนด", "find": "ภายในกำหนด 96 เดือน", "repl": "ภายในกำหนด {totalInstallments} เดือน"},
    {"anchor": "ผ่อนชำระเป็นงวดๆ ละ",
     "find": "ผ่อนชำระเป็นงวดๆ ละ 17,205 บาท (หนึ่งหมื่นเจ็ดพันสองร้อยห้าบาทถ้วน)",
     "repl": "ผ่อนชำระเป็นงวดๆ ละ {monthlyInstallment} บาท ({monthlyInstallmentText})"},
    {"anchor": "และกำหนดเริ่มชำระงวดแรก",
     "find": "ภายในวันที่ 30 ของทุกเดือน และกำหนดเริ่มชำระงวดแรกในวันที่ 31 พฤษภาคม 2569",
     "repl": "ภายใน{payDueText} และกำหนดเริ่มชำระงวดแรกในวันที่ {firstPayDate}"},

    # ── main signature (buyer) ──
    {"anchor": "นางสุวรรณา", "find": "ขวัญชัย แสนกันยา", "repl": "{buyerName}"},

    # ── promo attachment header (P081) ──
    {"anchor": "อันเป็นส่วนหนึ่งของสัญญาซื้อขายรถยนต์บรรทุก",
     "re": r"เลขที่ MTM145 ลงวันที่ 1 เดือน เมษายน\s+พ\.ศ\. 2569 ทะเบียนรถบรรทุกเลขที่ 71-2820",
     "repl": "เลขที่ {contractCode} ลงวันที่ {contractDay} เดือน {contractMonth}  พ.ศ. {contractYearBE} ทะเบียนรถบรรทุกเลขที่ {licensePlate}"},

    # ── promo 1 ──
    {"anchor": "รวมทั้งสิ้นจำนวน", "find": "รวมทั้งสิ้นจำนวน 96 งวด", "repl": "รวมทั้งสิ้นจำนวน {totalInstallments} งวด"},
    {"anchor": "ไม่เคยผิดนัดครบทุก", "find": "ไม่เคยผิดนัดครบทุก 9 งวด (เก้า)",
     "repl": "ไม่เคยผิดนัดครบทุก {pro1Every} งวด"},
    {"anchor": "ค่าตอบแทนพิเศษแก่ผู้ซื้อ จำนวน", "find": "จำนวน 1 ครั้ง (หนึ่ง)", "repl": "จำนวน 1 ครั้ง"},
    {"anchor": "เป็นจำนวนเงิน", "find": "เป็นจำนวนเงิน 17,205 บาท (หนึ่งหมื่นเจ็ดพันสองร้อยห้าบาทถ้วน)",
     "repl": "เป็นจำนวนเงิน {pro1Value} บาท ({pro1ValueText})"},
    {"anchor": "ในทุกงวดที่", "find": "ในทุกงวดที่ 10, 20, 30, 40, 50, 60, 70, 80, 90 ตามลำดับ",
     "repl": "ในทุกงวดที่ {pro1FreeAtInstallments} ตามลำดับ"},
    {"anchor": "รวมจำนวนงวดทั้งสิ้น", "find": "รวมจำนวนงวดทั้งสิ้น 9 งวด (เก้า)",
     "repl": "รวมจำนวนงวดทั้งสิ้น {pro1FreeCount} งวด"},
    {"anchor": "รวมเป็นจำนวนเงินทั้งสิ้น",
     "find": "รวมเป็นจำนวนเงินทั้งสิ้น 154,848 บาท (หนึ่งแสนห้าหมื่นสี่พันแปดร้อยสี่สิบแปดบาทถ้วน)",
     "repl": "รวมเป็นจำนวนเงินทั้งสิ้น {pro1TotalValue} บาท ({pro1TotalValueText})"},

    # ── promo 2 ──
    {"anchor": "ไม่เกิน", "find": "ไม่เกิน 80,000 บาท (แปดหมื่นบาทถ้วน)",
     "repl": "ไม่เกิน {pro2RepairBudget} บาท ({pro2RepairBudgetText})"},

    # ── promo 3 ──
    {"anchor": "ต่อปีไม่เกิน", "find": "ต่อปีไม่เกิน 11,826 บาท (หนึ่งหมื่นหนึ่งพันแปดร้อยยี่สิบหกบาทถ้วน)",
     "repl": "ต่อปีไม่เกิน {pro3AnnualPm} บาท ({pro3AnnualPmText})"},
]


def main():
    src, out = sys.argv[1], sys.argv[2]
    matched, unmatched = build_template(src, out, DOC_RULES)
    print(f"matched rules: {matched}/{len(DOC_RULES)}")
    if unmatched:
        print(f"!! UNMATCHED ({len(unmatched)}):")
        for r in unmatched:
            print("   -", r.get("find") or r.get("re"))
    else:
        print("all rules matched ✓")


if __name__ == "__main__":
    main()
