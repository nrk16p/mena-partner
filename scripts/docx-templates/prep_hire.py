"""Generate templates/hire.docx from the original hire .docx by inserting
{placeholders} in place of the specimen (ขวัญชัย แสนกันยา / MTM145 / 058-8-65373-0)
values.

สัญญาว่าจ้างขับรถยนต์บรรทุกสินค้า — the on-screen source of truth is
components/hire-contract-document.tsx.

Usage: python3 scripts/docx-templates/prep_hire.py <src.docx> <out.docx>
"""
import sys
from prep_lib import build_template

DOC_RULES = [
    # ── header ──
    {"anchor": "เลขสัญญา", "find": "MTM145", "repl": "{contractCode}"},
    {"anchor": "วันที่ 1 เดือน",
     "find": "วันที่ 1 เดือน เมษายน พ.ศ.2569",
     "repl": "วันที่ {contractDay} เดือน {contractMonth} พ.ศ.{contractYearBE}"},

    # ── ผู้รับจ้างที่ 1 (party) — all in paragraph [6] ──
    {"anchor": "ขวัญชัย", "find": "นาย ขวัญชัย แสนกันยา เลขประจำตัวประชาชน",
     "repl": "{buyerName} เลขประจำตัวประชาชน"},
    {"anchor": "00685", "find": "เลขประจำตัวประชาชน 3 7301 00685 00 3 ที่อยู่",
     "repl": "เลขประจำตัวประชาชน {nationalId} ที่อยู่"},
    {"anchor": "ทุ่งน้อย",
     "find": "เลขที่ 14/2 หมู่ที่ 6 ตำบล ทุ่งน้อย อำเภอ เมืองนครปฐม จังหวัด นครปฐม",
     "repl": "เลขที่ {driverAddress}"},

    # ── (3) สัญญาซื้อขายรถยนต์บรรทุก ฉบับลงวันที่ ──
    {"anchor": "ฉบับลงวันที่", "find": "1 เมษายน 2569", "repl": "{contractDateThai}"},

    # ── ข้อ 4: การว่าจ้าง...มีผลนับตั้งแต่วันที่ ──
    {"anchor": "นับตั้งแต่วันที่", "find": "1 เมษายน 2569", "repl": "{contractDateThai}"},

    # ── ข้อ 7: บัญชีธนาคาร ──
    {"anchor": "เข้าบัญชีธนาคาร", "find": "เข้าบัญชีธนาคาร กสิกรไทย ชื่อบัญชี",
     "repl": "เข้าบัญชีธนาคาร {bankName} ชื่อบัญชี"},
    {"anchor": "ชื่อบัญชี", "find": "ชื่อบัญชี นาย ขวัญชัย แสนกันยา เลขที่บัญชี",
     "repl": "ชื่อบัญชี {buyerName} เลขที่บัญชี"},
    {"anchor": "เลขที่บัญชี", "find": "เลขที่บัญชี 058-8-65373-0 โดยให้ถือว่า",
     "repl": "เลขที่บัญชี {accountNumber} โดยให้ถือว่า"},
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
