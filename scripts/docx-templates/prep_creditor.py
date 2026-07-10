"""Generate templates/creditor.docx from the original "เปิดรหัสเจ้าหนี้" .docx by
inserting {placeholders} into the blank (dotted) fields of the vendor-onboarding form.

The source file is an EMPTY form (all fields are dotted lines), so each rule matches
a label + its dotted run and rewrites it as label + {placeholder}. Dotted runs use a
mix of '.' (U+002E) and '…' (U+2026), matched by the char-class [.…]+.

Usage: python3 scripts/docx-templates/prep_creditor.py <src.docx> <out.docx>
"""
import sys
from prep_lib import build_template

D = r"[.…]+"  # a run of dots / ellipses (a blank fill line)

DOC_RULES = [
    # ── page 1: หัวกระดาษ รหัสเจ้าหนี้ ──
    {"anchor": "Winspeed", "find": "Winspeed", "repl": "Winspeed  {vendorCodeWinspeed}"},
    {"anchor": "ATMS", "find": "ATMS", "repl": "ATMS  {vendorCodeAtms}"},

    # ── page 1: วันที่ (บนสุด) ──
    {"anchor": "วันที่", "re": r"วันที่" + D, "repl": "วันที่ {docDate}"},

    # ── page 1: ชื่อเจ้าหนี้ (ไทย/อังกฤษ) ──
    {"anchor": "ชื่อเจ้าหนี้ (ภาษาไทย)",
     "re": r"ชื่อเจ้าหนี้ \(ภาษาไทย\)" + D + r"ชื่อเจ้าหนี้ \(ภาษาอังกฤษ\)" + D,
     "repl": "ชื่อเจ้าหนี้ (ภาษาไทย) {buyerName}  ชื่อเจ้าหนี้ (ภาษาอังกฤษ) {buyerNameEn}"},

    # ── page 1: เลขผู้เสียภาษี/บัตรประชาชน + ที่อยู่ ──
    {"anchor": "ที่อยู่ (ภาษาไทย)",
     "re": r"ประชาชน" + D + r"ที่อยู่ \(ภาษาไทย\)" + D,
     "repl": "ประชาชน {nationalId}  ที่อยู่ (ภาษาไทย) {driverAddress}"},

    # ── page 1: เงื่อนไขการจ่ายชำระเงิน ──
    {"anchor": "เงื่อนไขการจ่ายชำระเงิน",
     "re": r"เงื่อนไขการจ่ายชำระเงิน" + D,
     "repl": "เงื่อนไขการจ่ายชำระเงิน {paymentTerms}"},

    # ── page 1: ชื่อผู้ติดต่อ (1) ──
    {"anchor": "ชื่อผู้ติดต่อ (1)",
     "re": r"ชื่อผู้ติดต่อ \(1\)" + D + r"เบอร์โทร" + D + r"Email Address" + D,
     "repl": "ชื่อผู้ติดต่อ (1) {buyerName}  เบอร์โทร {phone}  Email Address {email}"},

    # ── page 1: ชื่อเจ้าของบัญชี + ประเภทบัญชี ──
    {"anchor": "หน้าเช็คสั่งจ่าย",
     "re": r"หน้าเช็คสั่งจ่าย" + D + r" ประเภทบัญชี" + D,
     "repl": "หน้าเช็คสั่งจ่าย {buyerName}  ประเภทบัญชี {bankAccountType}"},

    # ── page 1: หมายเลขบัญชีธนาคาร + สาขา ──
    {"anchor": "หมายเลขบัญชีธนาคาร",
     "re": r"หมายเลขบัญชีธนาคาร" + D + r" สาขา" + D,
     "repl": "หมายเลขบัญชีธนาคาร {bankAccount}  สาขา {bankBranch}"},

    # ── page 1: ( ชื่อผู้มีอำนาจ ) ใต้ลายเซ็น ──
    {"anchor": "(                                                      )",
     "find": "(                                                      )",
     "repl": "( {buyerName} )"},

    # ── page 2-3: PDPA ข้าพเจ้า (ชื่อ-สกุล) + เลขบัตรประชาชน ──
    {"anchor": "ข้าพเจ้า (ชื่อ-สกุล)",
     "re": r"ข้าพเจ้า \(ชื่อ-สกุล\)" + D + r"เลขบัตรประชาชน" + D + r"ในฐานะเจ้าของ",
     "repl": "ข้าพเจ้า (ชื่อ-สกุล) {buyerName}  เลขบัตรประชาชน {nationalId}  ในฐานะเจ้าของ"},

    # ── page 4: FC102-07 วันที่ ──
    {"anchor": "วันที่ ", "re": r"วันที่ " + D, "repl": "วันที่ {docDate}"},

    # ── page 4: ชื่อบริษัท ──
    {"anchor": "ชื่อบริษัท", "re": r"ชื่อบริษัท" + D, "repl": "ชื่อบริษัท {buyerName}"},

    # ── page 4: ที่อยู่ ──
    {"anchor": "ที่อยู่ ", "re": r"ที่อยู่ " + D, "repl": "ที่อยู่ {driverAddress}"},

    # ── page 4: ชนิดสินค้า ──
    {"anchor": "ชนิดสินค้า ", "re": r"ชนิดสินค้า " + D, "repl": "ชนิดสินค้า {productType}"},

    # ── page 4: ชื่อผู้ติดต่อ 1 + โทร ──
    {"anchor": "ชื่อผู้ติดต่อ 1",
     "re": r"ชื่อผู้ติดต่อ 1" + D + r" โทร " + D + r" แฟกซ์",
     "repl": "ชื่อผู้ติดต่อ 1 {buyerName} โทร {phone} แฟกซ์"},
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
