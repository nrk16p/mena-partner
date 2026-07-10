"""Generate templates/guarantee.docx from the original สัญญาค้ำประกัน .docx by
inserting {placeholders} in place of the specimen values.

Specimen data in the source doc:
  - ผู้ค้ำประกัน (guarantor): น.ส. รุ่งฤทัย รุ่งราษี / 3-1020-01210-41-1 /
    1196/15 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น เขตลาดกระบัง จังหวัดกรุงเทพมหานคร
  - ผู้ซื้อ (buyer): นายขวัญชัย แสนกันยา
  - contract date: 1 เมษายน พ.ศ. 2569
Note: this template has NO license plate and NO contract code anywhere.
The guarantor signature parentheses are blank in the specimen (with a couple of
stray "2557" artifacts) — we inject {guarantorName} and strip the artifacts.

Usage: python3 scripts/docx-templates/prep_guarantee.py <src.docx> <out.docx>
"""
import sys
from prep_lib import build_template

DOC_RULES = [
    # ── header date ──
    {"anchor": "วันที่ 1 เดือน",
     "find": "วันที่ 1 เดือน เมษายน พ.ศ 2569",
     "repl": "วันที่ {contractDay} เดือน {contractMonth} พ.ศ {contractYearBE}"},

    # ── ผู้ค้ำประกัน (guarantor) paragraph ──
    {"anchor": "ข้าพเจ้า", "find": "น.ส. รุ่งฤทัย รุ่งราษี", "repl": "{guarantorName}"},
    {"anchor": "ข้าพเจ้า", "find": "เลขประจำตัวประชาชน 3-1020-01210-41-1",
     "repl": "เลขประจำตัวประชาชน {guarantorNationalId}"},
    {"anchor": "ข้าพเจ้า",
     "find": "อยู่บ้านเลขที่ 1196/15 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น เขตลาดกระบัง จังหวัดกรุงเทพมหานคร",
     "repl": "อยู่บ้านเลขที่ {guarantorAddress}"},

    # ── ข้อ 1: buyer name + contract date ──
    {"anchor": "ตามที่", "find": "นายขวัญชัย แสนกันยา", "repl": "{buyerName}"},
    {"anchor": "ฉบับลงวันที่",
     "find": "ฉบับลงวันที่ 1 เมษายน พ.ศ. 2569",
     "repl": "ฉบับลงวันที่ {contractDay} {contractMonth} พ.ศ. {contractYearBE}"},

    # ── guarantor signature: inject {guarantorName} into the (empty) parens ──
    # NB: p[41] also carries a stray floating "2557" textbox (Choice+Fallback);
    # anchor on "2557" scopes this rule to the guarantor signature line, and the
    # regex touches only the paragraph's own parenthesis run — the textbox is
    # left untouched (it is a harmless artifact present in the source template).
    {"anchor": "2557", "re": r"\(\s+\)", "repl": "( {guarantorName} )"},
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
