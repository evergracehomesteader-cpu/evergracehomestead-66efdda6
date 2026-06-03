# Feed Inventory & Feeding Logs Overhaul

## Data model (new + changed tables)

**New: `feed_containers`** — physical storage locations
- `name` (e.g., "Blue Barrel", "Feed Bin", "Bag Storage")
- `capacity_lbs` (optional), `location` (optional notes), `active`

**New: `feed_container_stock`** — current pounds of each feed item inside each container
- `container_id`, `feed_item_id`, `stock_lbs` (running total)
- Unique on (container_id, feed_item_id)
- Updated by triggers on purchases (+) and feed logs (−)

**New: `feed_units`** — admin-configurable measurement units
- `name` (e.g., "Full bucket", "Half bucket", "Quarter bucket", "Scoop")
- `lbs_per_unit` (numeric)
- `is_system` flag for built-ins; "pounds" is always available implicitly
- Seeded with reasonable defaults; admins/managers can edit

**Changed: `feed_purchases`** — add
- `container_id` (where it was stored)
- `unit_type` ('bag' | 'lbs' | 'custom_unit')
- `bag_size_lbs` (when unit_type='bag')
- `bag_count` (when unit_type='bag')
- `custom_unit_id`, `custom_unit_qty`
- `total_lbs` (computed/derived, stored for reporting)
- `cost_per_bag_cents` (derived for display)

**Changed: `feed_logs`** — add
- `container_id` (which container it came from)
- `unit_id` (nullable — null means "pounds" directly)
- `unit_qty` (how many of that unit)
- `total_lbs` (auto-computed: unit_qty × unit.lbs_per_unit, or `quantity` when pounds)
- `target_type` ('animal' | 'breed' | 'species' | 'pen' | 'group')
- `target_value` (text — breed name / species / pen / group label)
- Keep existing `animal_id` for individual feedings

**Triggers**
- After insert on `feed_purchases`: increment `feed_container_stock.stock_lbs` and `feed_items.stock_qty`
- After insert on `feed_logs`: decrement `feed_container_stock.stock_lbs` and `feed_items.stock_qty`
- After delete: reverse both

RLS: authenticated read all; admin/manager write for containers & units; all authenticated can log purchases/feedings.

## UI

**Feed page (`/feed`)**
- Tabs: **Inventory** | **Containers** | **Units** | **Reports**
- Inventory tab: existing item cards, now showing per-container breakdown
- Purchase dialog (rewritten):
  - Pick feed item + container
  - Mode: Bags / Pounds / Custom unit
  - Bags: bag size (lbs) × bag count → auto-calc total lbs; cost per bag → total cost
  - Pounds: direct lbs + total cost
  - Custom unit: pick unit + qty + total cost
- Feeding log dialog (rewritten):
  - Pick feed item + container (filtered to containers holding that feed)
  - Target: Animal / Breed / Species / Pen / Group
  - Unit: Full/Half/Quarter bucket, Scoop, Pounds, or any custom unit
  - Qty → auto-shows computed total lbs before submit
- Containers tab (admin/manager): CRUD list with current stock per feed item
- Units tab (admin/manager): edit lbs/unit values

**Reports tab**
- Daily feed used (last 30 days, by feed item, line chart)
- Usage per animal / breed / species / pen (table)
- Days of feed remaining per container (current stock ÷ avg daily use)

## Files

- Migration: new tables, columns, triggers, seed units & containers
- `src/routes/_authenticated/feed.tsx` — rewrite with tabs
- `src/components/feed/PurchaseDialog.tsx` — new
- `src/components/feed/FeedingDialog.tsx` — new
- `src/components/feed/ContainersTab.tsx` — new
- `src/components/feed/UnitsTab.tsx` — new
- `src/components/feed/FeedReportsTab.tsx` — new

## Notes
- All weights stored in pounds (lbs) internally for consistency, even if a feed item's display `unit` is something else.
- Existing feed items/purchases/logs preserved; new columns nullable with sane defaults so old data still shows.
- Permissions: managing containers/units requires `admin` or `manager` role.

Ready to build on approval.
