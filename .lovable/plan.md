# Pens & Breeds

## Pens (new)

**Database** — new `public.pens` table:
- `name` (text, required), `species` (text), `capacity` (int), `location` (text), `notes` (text), `active` (bool default true), `created_by`, timestamps
- RLS: select for `authenticated`, write for admin/manager (same pattern as `feed_containers`)
- Keep existing `animals.current_pen` as text for now; the new pens UI populates the dropdown options. (Avoids a destructive migration to FK and keeps existing logs working.)

**UI**
- New route `src/routes/_authenticated/pens.tsx` with list + Add/Edit/Delete dialog (same shape as ContainersTab).
- Sidebar: add **Pens** entry under Manage (PawPrint-adjacent icon, e.g. `Fence` or `Square`).
- Animals form: change `current_pen` free-text input into a Select populated from `pens.name` (with "— none —" option).
- Feeding by Pen: already works in `FeedingDialog` via `animals.current_pen`. Its pen dropdown will automatically pick up the new pen names.

## Breeds

**Status check** — `breeds_catalog` table and `animals.breed` field already exist. Feeding by breed already works in `FeedingDialog`.

**What's actually missing**
- A **Breeds management** UI to add/edit/delete entries in `breeds_catalog` (per species). Add as a tab inside Settings (or a small section on the Animals page). I'll put it under **Settings → Breeds**.
- Animals form: replace the free-text **Breed** input with a Select sourced from `breeds_catalog` filtered by the chosen species, with an inline "+ Add new breed" option that writes to `breeds_catalog`.
- Animals list: add a **Breed** filter dropdown.
- Reports: add a "By breed" summary section (animal counts and feed usage by breed).

**Seed the example breeds** — Kunekune, Berkshire, IPP (pigs); Nigerian Dwarf (goat); Rouen (duck); Golden Laced Wyandotte (chicken); Calhoun × Pit Mix (dog). Seeded via insert tool against `breeds_catalog` (matched to existing species rows; created if missing).

## Files touched

- **Migration:** create `pens` table + RLS + grants
- **New:** `src/routes/_authenticated/pens.tsx`, `src/components/breeds/BreedsManager.tsx`
- **Edit:** `src/components/AppSidebar.tsx` (add Pens link)
- **Edit:** animal create/edit form (pen dropdown + breed dropdown — I'll locate it in `src/routes/_authenticated/animals.tsx` / `animals.$animalId.tsx`)
- **Edit:** animals list (add Breed filter)
- **Edit:** `src/routes/_authenticated/settings.tsx` (mount BreedsManager)
- **Edit:** `src/routes/_authenticated/reports.tsx` (add by-breed section)

## Notes

- No breaking changes to existing data — `current_pen` and `breed` stay as text columns.
- Feed-by-pen and feed-by-breed already function; this PR just makes the data they read from manageable in the UI.

Confirm and I'll implement.
