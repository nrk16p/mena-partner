# Structured Thai address on the driver page

**Date:** 2026-07-09
**Status:** Approved — implementing

## Goal

Replace the driver's single free-text `address` with structured fields (lean set) plus cascading autocomplete for จังหวัด → อำเภอ → ตำบล → รหัสไปรษณีย์. Drivers page only.

## Decisions

- **Lean field set**, **drivers page only**, **no auto-parse** of existing addresses.
- Keep composing a full `address` string on save (backward compat with contract PDF and other views).
- Bundle the Thai address dataset offline (no runtime external API); load it via dynamic `import()` so it only ships on the drivers page.

## Data model (Driver, `types/index.ts`)

Add optional fields; keep `address`:
- `addressDetail?: string` — บ้านเลขที่ / หมู่ / ซอย / ถนน (one free-text box)
- `subdistrict?: string` (ตำบล/แขวง)
- `district?: string` (อำเภอ/เขต)
- `province?: string` (จังหวัด)
- `postalCode?: string` (รหัสไปรษณีย์)
- `address?: string` — composed full string, rebuilt on save.

## Dataset — `data/thai-address.json`

Built from the open kongvut/thai-province-data dataset (province/amphure/tambon + zip_code). Compact nested shape to avoid repeating names:

```json
[{ "p": "จังหวัด", "a": [{ "n": "อำเภอ", "t": [{ "n": "ตำบล", "z": "10200" }] }] }]
```

Committed to the repo. `lib/thai-address.ts`:
- `loadThaiAddress()` — dynamic `import()` of the JSON (cached).
- `listProvinces()`, `listDistricts(province)`, `listSubdistricts(province, district)` → `{ name, zip }[]`.
- `composeThaiAddress({ addressDetail, subdistrict, district, province, postalCode })` — pure; Bangkok uses แขวง/เขต, others ต./อ./จ.

## Component — `components/thai-address-fields.tsx` (client)

Props: the 5 field values + `onChange(patch)` + `disabled`.
- `addressDetail` text input.
- จังหวัด / อำเภอ / ตำบล via `SearchCombobox` (reused), each filtered by the parent selection.
- Selecting ตำบล auto-fills `postalCode`; postal remains editable.
- Cascading resets: change จังหวัด → clear อำเภอ/ตำบล/postal; change อำเภอ → clear ตำบล/postal.

## Wiring — `app/drivers/[id]/page.tsx`

- Add the 5 fields to the local form type + fetch mapping.
- Edit view: replace the ที่อยู่ textarea with `<ThaiAddressFields>`, and compose `address` on save.
- Read view: show structured address if present, else fall back to the old `address` text.

## API — `app/api/drivers/[id]/route.ts`

Add the 5 new fields to the PUT `$set` whitelist; keep accepting composed `address`.

## Testing

- Unit: `composeThaiAddress` (normal + Bangkok + partial fields + empty).
- Sanity: dataset loads, `listProvinces()` ≈ 77, a known ตำบล returns its zip.
- Manual (revertible): on driver 6a4611026c4c842129c9b241, pick province→district→subdistrict, confirm zip auto-fills and the composed address saves; then revert.

## Rollout

- Backward compatible: existing `address` values remain; structured fields fill going forward.
- No migration.
