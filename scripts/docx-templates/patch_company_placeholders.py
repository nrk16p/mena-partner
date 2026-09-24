#!/usr/bin/env python3
"""แทนชื่อผู้ลงนาม/พยานที่ฝังอยู่ในไฟล์ต้นแบบ .docx ด้วย placeholder

เดิมชื่อคนเซ็นถูกพิมพ์ตายในไฟล์ต้นแบบ เปลี่ยนคนเซ็นทีต้องแก้ไฟล์ Word เอง
หลังรันสคริปต์นี้ ไฟล์ต้นแบบจะใช้ {sellerSig1} {sellerSig2} {witness1} {witness2}
แล้ว lib/contract-docx* จะเติมค่าจาก master (/admin/company) ตอนสร้างเอกสาร

ใช้: python3 scripts/docx-templates/patch_company_placeholders.py [--apply]
ไม่ใส่ --apply = รายงานว่าจะแก้อะไรบ้าง (dry-run)
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = ROOT / "templates"

# ชื่อที่ฝังอยู่ในไฟล์ต้นแบบ → placeholder ที่จะใช้แทน
NAMES = {
    "นางสุวรรณา ขจรวุฒิเดช": "{sellerSig1}",
    "นางสาวพัชรีรัตน์ ขจรวุฒิเดชภัทร์": "{sellerSig2}",
    "นางสาวนัชภัค ขจรวุฒิเดช": "{witness1}",
    "นางสาวธัญรดี ตะกิ่นนอก": "{witness2}",
}
XML_PARTS = ("word/document.xml", "word/header1.xml", "word/header2.xml", "word/footer1.xml", "word/footer2.xml")


def patch_xml(xml: str) -> tuple[str, int]:
    """แทนชื่อในข้อความ โดยยอมให้มีแท็ก XML คั่นกลาง (Word ชอบตัดคำเป็นหลาย run)"""
    total = 0
    for name, placeholder in NAMES.items():
        # ตัวอักษรแต่ละตัวอาจถูกคั่นด้วยแท็ก (Word ตัดเป็นหลาย run)
        # และช่องว่างในไฟล์จริงอาจมีหลายเคาะ ("พัชรีรัตน์  ขจรวุฒิเดชภัทร์") จึงยืดหยุ่นตรงช่องว่าง
        pattern = "".join(
            r"(?:\s|<[^>]+>)+" if ch == " " else re.escape(ch) + r"(?:<[^>]+>)*"
            for ch in name
        )
        xml, n = re.subn(pattern, placeholder, xml)
        total += n
    return xml, total


def main() -> int:
    apply = "--apply" in sys.argv
    grand = 0
    for docx in sorted(TEMPLATES.glob("*.docx")):
        zin = zipfile.ZipFile(docx)
        items = {n: zin.read(n) for n in zin.namelist()}
        zin.close()
        hits = 0
        for part in XML_PARTS:
            if part not in items:
                continue
            new, n = patch_xml(items[part].decode("utf-8"))
            if n:
                items[part] = new.encode("utf-8")
                hits += n
        grand += hits
        print(f"{docx.name}: แทน {hits} จุด")
        if apply and hits:
            shutil.copy2(docx, docx.with_suffix(".docx.bak"))
            with zipfile.ZipFile(docx, "w", zipfile.ZIP_DEFLATED) as zout:
                for name, data in items.items():
                    zout.writestr(name, data)
    print(("อัปเดตไฟล์แล้ว" if apply else "dry-run (ใส่ --apply เพื่อเขียนจริง)") + f" รวม {grand} จุด")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
