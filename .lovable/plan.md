
# EverGrace Homestead — Master Codex Implementation Plan

This codex is large enough that doing it in one pass would produce broken, half-wired modules. I'll deliver it in **6 phases**, each shippable on its own. Approve phase by phase. Existing data is preserved at every step.

## Guiding rules (apply to every phase)

- **No data loss.** Every migration is additive (new columns/tables) or backfills before dropping anything.
- **Beginner-friendly labels everywhere**: "Boy Pig (Boar)" style, with technical term in parentheses. Centralized in `src/lib/terminology.ts`.
- **Mobile-first**: every new screen designed at 389px width first.
- **Search + filter** standard on every list (reuse `SearchFilter.tsx`).
- **Edit + delete** on every record (reuse the `save` mutation pattern + `ConfirmDelete`).
- **Roles**: a separate `user_roles` table (admin / member / viewer) with `has_role()` security-definer function — never on profiles.

---

## Phase 1 — Animals & Breeding foundation (schema + UI)

The biggest single piece. Everything else references animals.

**Schema migration** (additive to existing `animals`):
- `breed_type` (purebred / cross / unknown), `secondary_breed`, `breed_percentage`, `breed_notes`
- `front_photo_url`, `side_photo_url`, `additional_photo_urls[]` (existing `photo_url` becomes `front_photo_url` via backfill)
- `auto_marking_description`, `user_edited_description`
- `life_stage`, `manual_life_stage_override`
- `is_intact_male`, `male_reproductive_status`, `castration_date`, `testicle_status_notes`
- `ownership`, `id_tag` (rename of existing `tag` via view), `temporary_record`
- New enum values for `animal_status`: `breeding, pregnant, grow_out, retained, pending_sale, pending_trade, butcher_planned, medical_hold, quarantine, pet`

**New tables**:
- `species_catalog` (name, common_breeds[], breeding_age_male/female_months, gestation_days) — seeded with Pigs/Goats/Chickens/Ducks/Dogs/Cats and the breed lists you provided
- `breeds_catalog` (species_id, breed_name, is_custom)
- `life_stage_rules` (per-species age thresholds + display terms)
- `litters` (mother_id, father_id, birth_date, male/female/unknown counts)

**UI**:
- Animals list: dual-line card (`Name • Sex` / `Species • Breed • Life Stage`), status badge, front+side photo thumbs
- Add/Edit form: species → breed dropdown cascade, breed-type toggle reveals secondary breed, "Does he have testicles?" plain-language intact field
- Auto life stage from birthdate + species rules, manual override
- `quickAddLitter` action that creates litter + N baby animal records linked to mother/father
- Breeding selector filter: hides babies/juveniles and castrated males

## Phase 2 — Inventories (Feed, Food, Groceries, Medications, Supplies)

Five new/upgraded list modules — same CRUD pattern, different fields.

- `feed_items` upgrade: add `brand`, `bag_weight`, `bags_purchased`, `cost_per_bag`, `estimated_days_remaining` (computed), `low_inventory_alert` flag
- New `food_inventory`, `groceries`, `human_medications`, `animal_medications`, `needed_supplies` tables
- Each gets a route under `_authenticated/`, search/filter, edit/delete, low-stock + expiration warnings
- Animal medications link to `animals.id` and write a `health_records` row when administered (withdrawal periods auto-set)

## Phase 3 — Operations (Water, Generator, Solar, Market Sales, Honey-Do)

Smaller log-style modules:
- `water_systems` + daily usage logs, freeze/low alerts (computed from latest readings)
- `generator_logs`, `solar_logs` with daily cost rollups
- `market_sales` with itemized line items and profit calc
- `honey_do_list` (separate from `tasks` — explicitly user-requested)
- Tasks upgrade: `assigned_to_user_ids[]`, multi-assignee, member-can-only-complete-own-task rule via RLS

## Phase 4 — Roles, multi-user, admin approval

- `user_roles` table + `has_role()` SECURITY DEFINER function
- `app_role` enum: `admin`, `member`, `viewer`, `pending`
- New users land as `pending`; admin approval screen promotes them
- All RLS policies migrate from "any authenticated" → role-checked
- User management screen (admin only): invite, approve, change role, deactivate
- **Important**: this is a breaking change to existing RLS. I'll write a backfill that promotes existing users to `admin` so nothing locks them out.

## Phase 5 — Offline-first sync

The big infrastructure piece. Implementation:

- **Dexie (IndexedDB)** mirror of all writeable tables
- Mutation queue: every create/update/delete writes to Dexie first, then enqueues a sync job
- Service worker (Workbox) for app-shell + read caching → app installable + works offline
- Background sync replays the queue when `navigator.onLine` flips true
- Conflict resolution: last-write-wins by `updated_at`, but the loser is kept in a `sync_conflicts` table with a banner UI for review
- "Pending sync" indicator in the header; per-record "synced/pending/conflict" badge

This phase touches every existing mutation. I'll abstract them through a single `useSyncedMutation()` hook to keep the diff manageable.

## Phase 6 — Dashboard rebuild + AI marking descriptions + cache/version

- Dashboard widgets per spec: Upcoming Births, Feed Warnings, Food Alerts, Medication Alerts, Needed Supplies, Generator Costs, Solar Reserve, Active Chores, Honey-Do, Pending Sales, Market Sales
- AI marking description: edge function `describe-animal` that calls `google/gemini-2.5-flash` with the front+side photo URLs, returns suggested text, user reviews/edits before save
- Version checking: build hash exposed at `/api/version`; client polls and shows "New version available — reload" toast
- Service worker `skipWaiting` + cache versioning so deployments don't strand users on stale UI

---

## What I'm explicitly NOT doing without confirmation

- Weather alerts (no weather provider chosen — needs an API key; recommend OpenWeatherMap)
- Push notifications for alerts (needs a separate setup)
- Native mobile app (this is a PWA — installable but not in app stores)

## How to proceed

Reply with **"Start Phase 1"** (or any phase number) and I'll write the migration first, wait for your approval, then ship the code. If you want to reorder phases or drop one, say so now.
