#!/usr/bin/env python3
"""
นำเข้ารถ Mixer 6 ล้อ กลุ่ม MS (54 คัน) จาก Excel ชีต "ใช้ขึ้นระบบ" — 2026-11-13

ทำ 4 อย่าง:
  1. master_price_list  : ติด sizeGroup = "ML" ให้แถวเดิมที่ยังไม่มีกลุ่ม
  2. master_price_list  : เพิ่ม 54 คัน sizeGroup = "MS" (เฉพาะทะเบียนที่ยังไม่มี — ไม่ทับของเดิม)
  3. vehicle_master     : เพิ่มรถที่ยังไม่มี โดยดึงยี่ห้อ/รุ่น/เลขรถ/ตัวถัง/เครื่อง จาก atms.vehiclemaster
  4. promotion_master   : เพิ่มโปรฯ (ฟรีซ่อม 30,000 · PM 1+2 = 11,600/ปี · ไม่มีฟรีค่างวด) เฉพาะที่ยังไม่มี
  5. promotion_entries  : pro2 + pro3 ต่อคัน (หน้า /promotions) เฉพาะที่ยังไม่มี proType นั้น
  6. promo_config       : repairBudget / annualPmCap (งบคงเหลือในหน้า /promotions) เฉพาะที่ยังไม่มี

Default = dry-run (ไม่เขียนอะไร)  ·  เขียนจริง: python3 scripts/import-ms-price-list.py --apply
ต้องมี MONGO_URI ใน .env.local
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
from pymongo import MongoClient, UpdateOne

ROOT  = Path(__file__).resolve().parent.parent
XLSX  = Path.home() / "Documents/github/Reference_data/Price list รถ MS 54 คัน 22092026 (1).xlsx"
SHEET = "ใช้ขึ้นระบบ"
APPLY = "--apply" in sys.argv


def env(key):
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"{key} not in .env.local")


def read_rows():
    ws = openpyxl.load_workbook(XLSX, data_only=True)[SHEET]
    hdr = [c.value for c in ws[2]]
    col = {h.replace("\n", " ").replace("  ", " ").strip(): i for i, h in enumerate(hdr) if h}
    def g(r, name):
        return r[col[name]]
    rows = []
    for r in ws.iter_rows(min_row=3, values_only=True):
        plate = (r[1] or "").strip()
        if not plate.startswith("สบ."):
            continue
        n = int(g(r, "★ ควรผ่อน กี่งวด"))
        mo = float(g(r, "★ ผ่อนรถ/ด"))
        rows.append({
            "truckNumber": r[0],
            "licensePlate": plate,
            "price": {
                "downPayment":          float(g(r, "รวมดาวน์")),
                "cashDown":             float(g(r, "ดาวน์เงินสด")),
                "remainingInstallment": float(g(r, "คงเหลือผ่อน")),
                "downInstallmentCount": int(g(r, "งวดผ่อนดาวน์")),
                "downInstallmentAmt":   float(g(r, "ผ่อนดาวน์/งวด")),
                "financeInstallments":  n,
                "monthlyPayment":       mo,
                "financeAmount":        float(g(r, "รวมยอดผ่อน")),
                "totalSalePrice":       float(g(r, "รวมยอดจัด")),
            },
            "promo": {
                "pro2RepairBudget": float(g(r, "🔧 โปร1 ฟรีซ่อม(บาท)")),
                "pro3AnnualPm":     float(g(r, "🛠️ PM รวม 1+2 /ปี")),
            },
        })
    return rows


def main():
    rows = read_rows()
    assert len(rows) == 54, f"expected 54 rows, got {len(rows)}"
    for x in rows:  # sanity: ยอดรวม = ยอดจัด + ดาวน์, ยอดจัด = งวด × ค่างวด
        p = x["price"]
        assert abs(p["financeAmount"] + p["downPayment"] - p["totalSalePrice"]) < 1, x
        assert abs(p["financeInstallments"] * p["monthlyPayment"] - p["financeAmount"]) < 1, x

    client = MongoClient(env("MONGO_URI"), serverSelectionTimeoutMS=10000)
    db = client[env("MONGO_DB") or "mena_partner"]
    atms = client["atms"]
    now = datetime.now(timezone.utc)
    plates = [x["licensePlate"] for x in rows]

    have_price = {d["licensePlate"] for d in db.master_price_list.find({"licensePlate": {"$in": plates}}, {"licensePlate": 1})}
    have_veh   = {d["licensePlate"] for d in db.vehicle_master.find({"licensePlate": {"$in": plates}}, {"licensePlate": 1})}
    have_promo = {d["licensePlate"] for d in db.promotion_master.find({"licensePlate": {"$in": plates}}, {"licensePlate": 1})}
    atms_v = {d["ทะเบียน"]: d for d in atms.vehiclemaster.find({"ทะเบียน": {"$in": plates}})}
    no_group = db.master_price_list.count_documents({"sizeGroup": {"$exists": False}, "licensePlate": {"$nin": plates}})

    print(f"rows from Excel        : {len(rows)}")
    print(f"ML tag (old rows)      : {no_group}")
    print(f"price  new / existing  : {len(rows) - len(have_price)} / {len(have_price)} {sorted(have_price)}")
    print(f"vehicle new / existing : {len(rows) - len(have_veh)} / {len(have_veh)}")
    print(f"promo  new / existing  : {len(rows) - len(have_promo)} / {len(have_promo)}")
    missing_atms = [p for p in plates if p not in atms_v]
    print(f"not found in ATMS      : {missing_atms}")
    fleets = {}
    for p in plates:
        if p in atms_v:
            f = atms_v[p].get("ฟลีท"); fleets[f] = fleets.get(f, 0) + 1
    print(f"ATMS fleets            : {fleets}")
    mism = [(x["licensePlate"], x["truckNumber"], atms_v[x["licensePlate"]].get("เลขรถ"))
            for x in rows if x["licensePlate"] in atms_v and atms_v[x["licensePlate"]].get("เลขรถ") != x["truckNumber"]]
    print(f"truckNumber Excel≠ATMS : {mism}")

    price_ops = [
        UpdateOne({"licensePlate": x["licensePlate"]},
                  {"$setOnInsert": {"licensePlate": x["licensePlate"], "sizeGroup": "MS", **x["price"],
                                    "createdAt": now, "updatedAt": now}}, upsert=True)
        for x in rows if x["licensePlate"] not in have_price
    ]

    def s(v):
        return v.strip() if isinstance(v, str) and v.strip() not in ("", "-") else None

    veh_ops = []
    for x in rows:
        if x["licensePlate"] in have_veh:
            continue
        a = atms_v.get(x["licensePlate"], {})
        doc = {
            "licensePlate": x["licensePlate"], "status": "active",
            "truckNumber": x["truckNumber"] or s(a.get("เลขรถ")),
            "brand": s(a.get("ยี่ห้อ")), "model": s(a.get("รุ่น")),
            "chassisNumber": s(a.get("เลขตัวถัง")), "engineNumber": s(a.get("เลขเครื่องยนต์")),
            "vehicleType": s(a.get("ประเภทยานพาหนะ")) or "Mixer 6 ล้อ", "truckType": "mixer",
            "characteristic": "บรรทุกเฉพาะกิจ (คอนกรีตผสมเหลว)",
            "createdAt": now, "updatedAt": now.isoformat(),
            "updatedBy": "claude-code (นำเข้ารถ MS 54 คัน 2026-11-13)",
        }
        veh_ops.append(UpdateOne({"licensePlate": x["licensePlate"]},
                                 {"$setOnInsert": {k: v for k, v in doc.items() if v is not None}}, upsert=True))

    promo_ops = [
        UpdateOne({"licensePlate": x["licensePlate"]},
                  {"$setOnInsert": {"licensePlate": x["licensePlate"], **x["promo"], "createdAt": now, "updatedAt": now}},
                  upsert=True)
        for x in rows if x["licensePlate"] not in have_promo
    ]

    have_entry = {(d["licensePlate"], d["proType"]) for d in db.promotion_entries.find({"licensePlate": {"$in": plates}}, {"licensePlate": 1, "proType": 1})}
    have_cfg   = {d["licensePlate"] for d in db.promo_config.find({"licensePlate": {"$in": plates}}, {"licensePlate": 1})}
    entry_docs = []
    for x in rows:
        rb, pm = x["promo"]["pro2RepairBudget"], x["promo"]["pro3AnnualPm"]
        for pt, det, label in (("pro2", {"repairBudget": rb}, f"ฟรีซ่อม ฿{rb:,.0f}"),
                               ("pro3", {"annualPm": pm},     f"PM รวม/ปี ฿{pm:,.0f}")):
            if (x["licensePlate"], pt) not in have_entry:
                entry_docs.append({"licensePlate": x["licensePlate"], "proType": pt, "active": True, "details": det,
                                   "label": label, "disabledAt": None, "disabledReason": None,
                                   "createdAt": now, "updatedAt": now})
    cfg_ops = [
        UpdateOne({"licensePlate": x["licensePlate"]},
                  {"$setOnInsert": {"licensePlate": x["licensePlate"], "repairBudget": x["promo"]["pro2RepairBudget"],
                                    "annualPmCap": x["promo"]["pro3AnnualPm"], "createdAt": now}}, upsert=True)
        for x in rows if x["licensePlate"] not in have_cfg
    ]
    print(f"promo entries new      : {len(entry_docs)}  · promo_config new: {len(cfg_ops)}")

    print("sample price :", price_ops[0]._doc if price_ops else None)
    print("sample veh   :", veh_ops[0]._doc if veh_ops else None)
    print("sample promo :", promo_ops[0]._doc if promo_ops else None)

    if not APPLY:
        print("\nDRY-RUN — nothing written. Re-run with --apply")
        return

    r0 = db.master_price_list.update_many({"sizeGroup": {"$exists": False}, "licensePlate": {"$nin": plates}},
                                          {"$set": {"sizeGroup": "ML"}})
    print("ML tagged      :", r0.modified_count)
    if price_ops: print("price inserted :", db.master_price_list.bulk_write(price_ops, ordered=False).upserted_count)
    if veh_ops:   print("veh inserted   :", db.vehicle_master.bulk_write(veh_ops, ordered=False).upserted_count)
    if promo_ops: print("promo inserted :", db.promotion_master.bulk_write(promo_ops, ordered=False).upserted_count)
    if entry_docs: print("entries inserted:", len(db.promotion_entries.insert_many(entry_docs).inserted_ids))
    if cfg_ops:    print("config inserted :", db.promo_config.bulk_write(cfg_ops, ordered=False).upserted_count)
    print("price_list total:", db.master_price_list.count_documents({}),
          "| MS:", db.master_price_list.count_documents({"sizeGroup": "MS"}),
          "| ML:", db.master_price_list.count_documents({"sizeGroup": "ML"}))


if __name__ == "__main__":
    main()
