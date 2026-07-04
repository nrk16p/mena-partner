"""
Migrate promotion_master (3 fixed fields/plate) → promotion_entries (one doc per promotion).
Idempotent: uses upsert on (licensePlate + proType), skips existing docs.

Run: python3 scripts/migrate-promotions-to-entries.py
"""
from pymongo import MongoClient, UpdateOne
from datetime import datetime, timezone

MONGO_URI  = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB_NAME    = "mena_partner"

def main():
    client = MongoClient(MONGO_URI)
    db     = client[DB_NAME]
    now    = datetime.now(timezone.utc)

    masters = list(db["promotion_master"].find({}))
    print(f"Found {len(masters)} plates in promotion_master")

    ops = []
    for m in masters:
        plate = m["licensePlate"]

        # Pro 1 — ฟรีค่างวด
        ops.append(UpdateOne(
            {"licensePlate": plate, "proType": "pro1"},
            {"$set": {
                "licensePlate": plate,
                "proType":      "pro1",
                "label":        f"ฟรีค่างวด ({m.get('pro1Condition','')}) × {m.get('pro1FreeCount',0)} งวด",
                "active":       True,
                "disabledReason": None,
                "disabledAt":   None,
                "details": {
                    "freeCount":          m.get("pro1FreeCount", 0),
                    "totalValue":         m.get("pro1TotalValue", 0),
                    "installmentValue":   m.get("pro1InstallmentValue", 0),
                    "condition":          m.get("pro1Condition", ""),
                    "freeAtInstallments": m.get("pro1FreeAtInstallments", ""),
                },
                "updatedAt": now,
            }, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        ))

        # Pro 2 — ฟรีซ่อม
        ops.append(UpdateOne(
            {"licensePlate": plate, "proType": "pro2"},
            {"$set": {
                "licensePlate": plate,
                "proType":      "pro2",
                "label":        f"ฟรีซ่อม ฿{m.get('pro2RepairBudget',0):,}",
                "active":       True,
                "disabledReason": None,
                "disabledAt":   None,
                "details": {
                    "repairBudget": m.get("pro2RepairBudget", 0),
                },
                "updatedAt": now,
            }, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        ))

        # Pro 3 — PM
        ops.append(UpdateOne(
            {"licensePlate": plate, "proType": "pro3"},
            {"$set": {
                "licensePlate": plate,
                "proType":      "pro3",
                "label":        f"PM รวม/ปี ฿{m.get('pro3AnnualPm',0):,}",
                "active":       True,
                "disabledReason": None,
                "disabledAt":   None,
                "details": {
                    "annualPm": m.get("pro3AnnualPm", 0),
                },
                "updatedAt": now,
            }, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        ))

    if ops:
        result = db["promotion_entries"].bulk_write(ops, ordered=False)
        print(f"promotion_entries — upserted: {result.upserted_count}, modified: {result.modified_count}")

    # Indexes
    db["promotion_entries"].create_index([("licensePlate", 1), ("proType", 1)])
    db["promotion_entries"].create_index("licensePlate")
    db["promotion_entries"].create_index("active")
    print("Indexes: OK")
    client.close()

if __name__ == "__main__":
    main()
