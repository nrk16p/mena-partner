#!/usr/bin/env python3
"""Add any plate from master_price_list that is missing in vehicle_master."""
from pymongo import MongoClient, UpdateOne
from datetime import datetime, timezone

URI = "mongodb+srv://adminbew:K879w5XpBm3QL046@mn-mongodb-ops-2c8032e6.mongo.ondigitalocean.com/terminus?authSource=admin"
DB  = "mena_partner"

def main():
    client   = MongoClient(URI)
    db       = client[DB]
    now      = datetime.now(timezone.utc)

    price_plates   = {d["licensePlate"] for d in db["master_price_list"].find({}, {"licensePlate": 1})}
    vehicle_plates = {d["licensePlate"] for d in db["vehicle_master"].find({}, {"licensePlate": 1})}

    missing = sorted(price_plates - vehicle_plates)
    print(f"Price-list: {len(price_plates)}  Vehicles: {len(vehicle_plates)}  Missing: {len(missing)}")

    if not missing:
        print("No missing plates — already in sync.")
        return

    ops = [
        UpdateOne(
            {"licensePlate": plate},
            {"$setOnInsert": {
                "licensePlate": plate,
                "status":       "active",
                "createdAt":    now,
                "updatedAt":    now,
            }},
            upsert=True,
        )
        for plate in missing
    ]

    result = db["vehicle_master"].bulk_write(ops, ordered=False)
    print(f"Inserted: {result.upserted_count}  Already existed: {result.matched_count}")

    total = db["vehicle_master"].count_documents({})
    print(f"vehicle_master total after sync: {total}")

if __name__ == "__main__":
    main()
