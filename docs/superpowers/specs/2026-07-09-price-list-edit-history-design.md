# Price-list edit history (audit log)

**Date:** 2026-07-09
**Status:** Approved design — ready for implementation plan

## Goal

On `/price-list`, record **who** changed a row's sale status / repair window and **when**, as an append-only history viewable per row. Editing scope is unchanged (sale status + repair window only, admin-only).

## Non-goals (YAGNI)

- Not making financial figures editable.
- No inline "last edited by" on the row (history is via a drawer only).
- No app-wide audit UI yet — the storage is shaped generically so it *can* extend to other entities later, but only price-list is implemented now.
- No backfill: history starts accumulating from deploy; past edits are not reconstructable.

## Storage — new collection `activity_log`

Append-only. One document per edit that actually changed something:

```js
{
  entity:   "price_list",              // generic, for future reuse
  entityId: "สบ.71-2032",              // licensePlate
  action:   "saleStatus",
  changes: {                            // ONLY fields whose value changed
    saleStatus:  { from: "ready", to: "repair15" },
    repairStart: { from: null,    to: "2026-07-09" },
    repairEnd:   { from: null,    to: "2026-07-20" }
  },
  editedBy: { email: "x@menatransport.co.th", name: "..." },
  editedAt: "2026-07-09T02:40:00.000Z"   // ISO string, matches existing updatedAt style
}
```

Index: `{ entity: 1, entityId: 1, editedAt: -1 }` (created lazily on first write, or documented as a manual step).

## Write path — modify `POST /api/price-list/status`

`app/api/price-list/status/route.ts`:

1. Resolve the editor server-side via `getServerSession(authOptions)` → `{ email, name }`. (Middleware already guarantees an admin for non-GET; if session is somehow missing, fall back to `editedBy: { email: "unknown" }` rather than failing the save.)
2. Read the current `master_price_list` doc first to capture old values (`saleStatus`, `repairStart`, `repairEnd`).
3. Perform the existing `updateOne` (unchanged behavior + `updatedAt`).
4. Compute the diff of the three tracked fields (old vs the new normalized values already computed in the route).
5. **Only if `changes` is non-empty**, insert one `activity_log` document. No-op saves write nothing.

Failure isolation: if the `activity_log` insert throws, log it server-side but still return `{ ok: true }` — the audit log must never break the primary edit.

## Read path — new `GET /api/price-list/history?plate=<plate>`

New file `app/api/price-list/history/route.ts`:

- Query `activity_log` for `{ entity: "price_list", entityId: plate }`, sort `editedAt: -1`, limit ~100.
- Returns `[{ changes, editedBy, editedAt }, ...]`.
- Available to any signed-in user (consistent with other GET read APIs); no admin gate.

## UI — `app/price-list/page.tsx`

- Add a small **history icon button** (clock) on each row, next to the existing status-edit control.
- Clicking opens a **drawer/modal** (`PriceHistoryDrawer`, new component) that fetches `/api/price-list/history?plate=<plate>` and renders a timeline, newest first:
  - Each entry: editor name (or email) · Thai date-time · human-readable change lines.
  - Change rendering maps field keys + status codes to Thai labels, e.g.
    `สถานะ: พร้อมขาย → ซ่อม 15 วัน`, `กำหนดเสร็จ: — → 20 ก.ค. 2569` (reuse `SALE_STATUS_CONFIG` labels and `thaiShortDate`).
  - Empty state: `ยังไม่มีประวัติการแก้ไข`.
- After a successful status edit in the existing modal, the history (if open for that plate) can refetch — minor nicety, not required.

## Components / interfaces

| Unit | Purpose | Depends on |
|---|---|---|
| `activity_log` collection | append-only audit store | mongo |
| `logActivity()` helper in `lib/activity-log.ts` | single place that shapes + inserts an entry (entity, entityId, action, changes, editedBy, editedAt) with a diff util | mongo, session |
| `POST /api/price-list/status` (edit) | resolve editor, diff, update, log | `logActivity`, `authOptions` |
| `GET /api/price-list/history` | read a plate's timeline | mongo |
| `PriceHistoryDrawer` component | render timeline | history API, thai-format, status config |

`lib/activity-log.ts` keeps the audit shape in one place so a future contract/vehicle audit reuses it.

## Testing

- Unit: `diffFields(old, next, keys)` returns only changed fields with `{from,to}`; returns empty when nothing changed.
- Unit/integration: `POST /status` inserts exactly one log entry on a real change, zero on a no-op, and never fails the save when the log insert throws (mock).
- Manual: edit a row locally (authenticated), open the drawer, confirm the entry with correct editor + Thai labels; verify a no-op save adds nothing.

## Rollout

- New collection auto-created on first insert; no migration.
- Backward compatible: existing edit behavior unchanged; history simply starts populating.
