#!/usr/bin/env python3
"""
ลบลิงก์รูปที่เสีย (HEAD ได้ 404) ออกจาก vehicle_master — 2026-11-13
สาเหตุ: รายงานรถสะอาดบางรอบอ้างไฟล์ใน DO Spaces ที่ถูกลบไปแล้ว → การ์ดหน้า /trucks ค้าง "กำลังโหลดรูป"

- เช็กทุกลิงก์ใน photoUrl + photos.* ของรถที่อยู่ใน master_price_list
- ลบเฉพาะลิงก์ที่ได้ 404 จริง (ข้อผิดพลาดเครือข่ายอื่นไม่ลบ)
- photoUrl เสีย → แทนด้วยรูปด้านที่ยังใช้ได้ (front → left → right → back → cabin) ไม่มีเลย = ลบ photoUrl
- เก็บสำรองลิงก์ที่ลบไว้ใน vehicle_master.deadPhotos (ย้อนกลับได้)

Default = dry-run  ·  เขียนจริง: python3 scripts/remove-dead-photos.py --apply
"""
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient, UpdateOne

ROOT = Path(__file__).resolve().parent.parent
APPLY = "--apply" in sys.argv
ORDER = ["front", "left", "right", "back", "cabin"]


def env(key, default=None):
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')
    return default


def status(url):
    u = urllib.parse.quote(url.strip(), safe=":/?=&%")
    try:
        return urllib.request.urlopen(urllib.request.Request(u, method="HEAD"), timeout=20).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None  # เครือข่ายมีปัญหา → ไม่ถือว่าเสีย


def main():
    db = MongoClient(env("MONGO_URI"), serverSelectionTimeoutMS=10000)[env("MONGO_DB", "mena_partner")]
    plates = [d["licensePlate"] for d in db.master_price_list.find({}, {"licensePlate": 1})]
    vehicles = list(db.vehicle_master.find({"licensePlate": {"$in": plates}}, {"licensePlate": 1, "photoUrl": 1, "photos": 1}))

    urls = set()
    for v in vehicles:
        for u in [v.get("photoUrl"), *(v.get("photos") or {}).values()]:
            if isinstance(u, str) and u.startswith("http"):
                urls.add(u)
    with ThreadPoolExecutor(16) as ex:
        st = dict(zip(urls, ex.map(status, urls)))
    dead = {u for u, s in st.items() if s == 404}
    print(f"checked {len(urls)} urls · dead {len(dead)} · unreachable {sum(1 for s in st.values() if s is None)}")

    now = datetime.now(timezone.utc)
    ops, no_photo = [], []
    for v in vehicles:
        photos = dict(v.get("photos") or {})
        removed = {k: u for k, u in photos.items() if u in dead}
        cur = v.get("photoUrl")
        if not removed and cur not in dead:
            continue
        unset = {f"photos.{k}": "" for k in removed}
        set_ = {"deadPhotos": {**removed, **({"photoUrl": cur} if cur in dead else {})},
                "updatedAt": now.isoformat(), "updatedBy": "claude-code (ลบลิงก์รูปเสีย 2026-11-13)"}
        if cur in dead:
            alive = [photos[k] for k in ORDER if photos.get(k) and photos[k] not in dead]
            if alive:
                set_["photoUrl"] = alive[0]
            else:
                unset["photoUrl"] = ""
                no_photo.append(v["licensePlate"])
        print(f"  {v['licensePlate']}: remove {sorted(removed)}{' + photoUrl' if cur in dead else ''}"
              f"{' → ' + set_['photoUrl'][-40:] if 'photoUrl' in set_ else ''}")
        ops.append(UpdateOne({"_id": v["_id"]}, {"$set": set_, **({"$unset": unset} if unset else {})}))

    print(f"vehicles to fix: {len(ops)} · left with no photo: {len(no_photo)} {no_photo}")
    if not APPLY:
        print("DRY-RUN — nothing written. Re-run with --apply")
        return
    if ops:
        print("modified:", db.vehicle_master.bulk_write(ops, ordered=False).modified_count)


if __name__ == "__main__":
    main()
