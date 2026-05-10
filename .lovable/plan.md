## Phase 2: Smart Tracking, Reminders & Reports

This is a large multi-system upgrade. Here's the plan, scoped to ship in one pass while keeping the existing structure, RLS, and rustic-modern style.

### 1. Database additions (one migration)

New tables:
- `tasks` — id, title, notes, due_date, completed, completed_at, category (general/animal/garden/compost/feed/bill), link_type, link_id, created_by, timestamps
- `animal_events` — id, animal_id, event_type (photo/medical/breeding/heat/birth/move/status/note), event_date, title, details (jsonb), created_by, created_at — unified timeline feed
- `income_entries` — id, source, category (sale/barter/other), amount_cents, entry_date, link_type, link_id, notes, created_by — for financial reports (expenses already covered by `bills` + `feed_purchases`)

Add: `current_pen` text on `animals` (for move tracking).

Compost: add `last_turned_on` (date) on a new lightweight `compost_piles` table OR reuse `compost_entries` via an `entry_type='turn'` row (already supported — just surface it). Use existing column.

Garden: add `last_watered_on`, `watering_interval_days` to `garden_plots`.

All tables get `*_all_auth` RLS (matching existing pattern).

### 2. New shared module: `src/lib/reminders.ts`

Pure function `computeReminders({ animals, heats, pregs, feed, bills, tasks, garden, compost, barter })` returns a typed list:
```
{ id, kind, severity: 'info'|'warning'|'urgent', title, subtitle, dueDate, link }
```
Rules:
- Heat: females with last heat >18 days ago (species-aware)
- Breeding follow-up: pregnancy `suspected` >21 days → confirm
- Pregnancy watch: `active` within 7 days of due
- Due countdowns: pregnancies, bills, tasks, barter
- Feed restock: stock ≤ threshold
- Compost turn: last turn >7 days
- Garden water/harvest: based on interval + expected_harvest

### 3. Routes added/updated

New:
- `src/routes/_authenticated/tasks.tsx` — list, add, complete, delete, filter by status/category
- `src/routes/_authenticated/calendar.tsx` — month view (react-day-picker) overlaying heats, breedings, due dates, births
- `src/routes/_authenticated/reports.tsx` — monthly income/expense/feed/barter/profit cards + month picker
- `src/routes/_authenticated/reminders.tsx` — full reminder list

Updated:
- `dashboard.tsx` — Today's tasks, Urgent alerts (top), Upcoming births, Low feed, Pending barter, Monthly snapshot row
- `animals.$animalId.tsx` — unified Timeline tab pulling from `animal_events` + derived events
- `feed.tsx` — per-item Usage Calculator card (days remaining from avg log usage, monthly $/lb, low projection)
- `barter.tsx` — value comparison badge (given vs received), already-linked items kept
- `AppSidebar.tsx` — add Tasks, Calendar, Reports, Reminders entries

### 4. Search & Filters

Add a reusable `<SearchBar />` + filter chips component (`src/components/SearchFilter.tsx`) and wire into animals, feed, bills, barter, tasks, garden, compost lists.

### 5. Mobile usability

- Floating "+" FAB on key list pages
- Larger tap targets on row actions
- AlertDialog confirmations on all deletes (centralized helper)
- Photo upload: switch to drag/preview/remove pattern with progress

### 6. Security
Keep `*_all_auth` RLS, photo buckets stay as configured, all writes set `created_by = auth.uid()`, zod validation on all forms, AlertDialog on delete.

### Out of scope (per user)
No public sharing, no marketplace, no AI.

### Technical notes
- Reminder computation is client-side from already-fetched react-query data (no new server fn needed).
- Calendar uses existing shadcn Calendar with custom day modifiers.
- Reports use date-fns month windows over `bills`, `feed_purchases`, `barter_deals` (estimated_value), `income_entries`.
- All new dirs follow existing `src/routes/_authenticated/*` convention.

Approve and I'll run the migration + build everything.
