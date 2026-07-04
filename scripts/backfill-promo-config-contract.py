#!/usr/bin/env python3
"""Backfill promo_config.contractCode from known plate->contract mappings.

Mapping priority: contracts > repair_monthly > gps_config (same as
lib/promo-usage.ts getPlateContractMap). Idempotent — only fills docs whose
contractCode is missing/empty and never overwrites an existing value.
"""
import os
import re
import sys

from pymongo import MongoClient


def load_env(path=".env.local"):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k] = v.strip().strip('"').strip("'")
    return env


def norm(p):
    return re.sub(r"^[^0-9]*", "", p or "").strip()


def main():
    env = load_env()
    db = MongoClient(env["MONGO_URI"], serverSelectionTimeoutMS=8000)[env.get("MONGO_DB", "mena_partner")]

    mapping = {}
    for coll in ["gps_config", "repair_monthly", "contracts"]:  # later overrides earlier
        for d in db[coll].find({}, {"licensePlate": 1, "contractCode": 1}):
            plate, cc = norm(d.get("licensePlate")), d.get("contractCode")
            if plate and cc:
                mapping[plate] = cc

    print(f"known plate->contract mappings: {len(mapping)}")

    filled = skipped = nomap = 0
    for cfg in db.promo_config.find({}):
        if cfg.get("contractCode"):
            skipped += 1
            continue
        cc = mapping.get(norm(cfg.get("licensePlate")))
        if not cc:
            nomap += 1
            continue
        db.promo_config.update_one({"_id": cfg["_id"]}, {"$set": {"contractCode": cc}})
        print(f"  {cfg.get('licensePlate')} -> {cc}")
        filled += 1

    print(f"filled: {filled} | already had: {skipped} | no mapping (not in fleet): {nomap}")


if __name__ == "__main__":
    sys.exit(main())
