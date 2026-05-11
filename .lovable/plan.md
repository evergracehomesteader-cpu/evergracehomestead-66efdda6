# Phase 3 — Homestead Intelligence

Builds on Phase 1/2 schema. Four feature pillars, each touching DB + UI.

## 1. Advanced Animal Records

New tables:
- `health_records` — vaccination, deworming, treatment, injury, illness, vet visit, body condition note. Fields: animal_id, record_type, product (med name), dosage, administered_on, withdrawal_meat_until, withdrawal_milk_until, withdrawal_eggs_until, vet_contact, notes.
- `contacts` — vet/farrier/breeder/buyer directory. Fields: name, role, phone, email, location, notes.

UI on `/animals/$animalId`:
- New **Health** tab: timeline of records, add/edit/delete, color-coded by type.
- New **Withdrawals** banner: shows active withholding periods (red badge) for meat/milk/eggs.
- **Growth chart**: line chart of weight_logs over time (recharts) on Weight tab.
- **Body condition** notes feed into health timeline.

New route `/contacts` — directory page (vet, feed store, breeder, buyer).

## 2. Lineage & Breeding Tree

Reuse existing `animals.mother_id` / `father_id`.

UI on `/animals/$animalId`:
- New **Lineage** tab: visual 3-generation tree (grandparents → parents → self → offspring) using a CSS grid layout, no extra deps.
- **Breeding pair history** — recompute from `pregnancies` grouped by (animal_id, sire_id).

New on `PregAdd` dialog and a dedicated **Plan breeding** action:
- **Inbreeding warning** — when selecting a sire, walk up to 3 generations of ancestors on both sides; if any common ancestor found, show red alert with the relation.

New table `breeding_decisions` — per-animal note: decision (`keep`, `breed`, `sell`, `butcher`), target_date, reason. Surfaced as a card on the animal detail page.

## 3. Production Tracking

New table `production_logs`:
- animal_id (nullable, for group entries), group_label, product_type (eggs, milk, meat, offspring, harvest, compost), quantity, unit, produced_on, value_cents, notes.

Garden harvests and compost output also flow into this single table for unified reporting.

New route `/production`:
- Quick-log buttons per type (Eggs / Milk / Meat / Harvest / Compost).
- Filter by animal, type, date range.
- Daily/weekly/monthly totals + trend chart.

Hooks into existing dashboard: today's egg/milk count card.

## 4. Profit & Cost Per Animal

Derives entirely from existing + new tables — no new "cost" table. Per-animal P&L computed from:
- **Purchase cost**: new `animals.purchase_cost_cents`, `purchase_date` columns.
- **Feed cost**: `feed_logs.quantity` × current `feed_items.price_cents` / package_size, joined by animal_id.
- **Medical cost**: new `health_records.cost_cents`.
- **Breeding cost**: new `pregnancies.breeding_cost_cents`.
- **Sale / income**: existing `income_entries` filtered by `link_type='animal'` and `link_id=animal.id`.
- **Production value**: `production_logs.value_cents` for that animal.

UI:
- New **Finances** tab on animal detail: card grid (Invested / Earned / Net), itemized table.
- `/reports` page gets a **Top earners / biggest losses** ranked list.

## Schema diagram

```text
animals ──┬─ health_records ─── contacts (vet)
          ├─ weight_logs (existing)
          ├─ pregnancies (existing, +breeding_cost_cents)
          ├─ production_logs
          ├─ breeding_decisions
          └─ income_entries (existing, link_type='animal')
```

## Technical notes

- All new tables: `created_by uuid`, RLS `*_all_auth` policy (matches existing shared-family model), `updated_at` trigger where mutable.
- Charts use existing `recharts` (already in shadcn chart component).
- Lineage tree: pure CSS grid, recursive React component, capped at 3 generations to keep mobile-friendly.
- Inbreeding check runs client-side after fetching ancestor IDs (≤30 rows).
- Withdrawal banner: client-side computed from `health_records` where `withdrawal_*_until >= today`.
- Money everywhere in cents (matches existing pattern).
- No new npm deps.

## Files

New:
- `supabase/migrations/<ts>_phase3.sql`
- `src/lib/lineage.ts` (ancestor walk + inbreeding detection)
- `src/lib/animal-finance.ts` (P&L compute)
- `src/components/LineageTree.tsx`
- `src/components/WithdrawalBanner.tsx`
- `src/routes/_authenticated/contacts.tsx`
- `src/routes/_authenticated/production.tsx`

Edited:
- `src/routes/_authenticated/animals.$animalId.tsx` — Health, Lineage, Finances tabs + growth chart + decision card.
- `src/routes/_authenticated/animals.tsx` — purchase cost field on add form.
- `src/routes/_authenticated/dashboard.tsx` — today's production card, withdrawal alerts.
- `src/routes/_authenticated/reports.tsx` — top earners.
- `src/components/AppSidebar.tsx` — Contacts + Production nav.

Out of scope (explicit): public sharing, marketplace, AI predictions.