# Demo Mode Plan

Full offline demo that swaps Supabase for a localStorage-backed mock, seeds months of realistic homestead data, and never touches the real backend.

## Architecture

```text
Login ──► [Try Demo Mode] ──► seed localStorage ──► set demo flag ──► /dashboard
                                        │
Every hook ──► supabase client ──► demo-aware proxy
                                     ├── demo on  → LocalDB (localStorage)
                                     └── demo off → real Supabase (unchanged)
```

**Key idea:** wrap the exported `supabase` client with a Proxy. When `localStorage["demo_mode"]==="1"`, `.from(table)` returns a fake query builder that reads/writes `localStorage["demo_db"]`. `.auth` returns a fake session for a demo user. Everything else in the app stays untouched — no per-hook branching, no risk of leaking demo writes to production.

## Scope

### 1. Demo infrastructure (new files)
- `src/lib/demo/localDb.ts` — in-memory + localStorage store keyed by table. CRUD helpers: `list`, `insert`, `update`, `delete`, with basic filter/order/limit matching what the app uses (`eq`, `in`, `gte`, `lte`, `order`, `limit`, `single`, `maybeSingle`).
- `src/lib/demo/queryBuilder.ts` — Supabase-compatible chainable builder backed by LocalDB. Supports the subset of PostgREST the app calls (verified via ripgrep over hooks/routes).
- `src/lib/demo/fakeAuth.ts` — fake `auth.getUser`, `getSession`, `onAuthStateChange`, `signOut` returning a static demo user.
- `src/lib/demo/mode.ts` — `isDemoMode()`, `enterDemoMode()`, `exitDemoMode()`, `resetDemo()`. Enter seeds and reloads to `/dashboard`; exit clears keys and reloads to `/login`.
- `src/lib/demo/seed.ts` — the seed dataset (see §3).
- `src/integrations/supabase/client.ts` — wrap the exported client in a Proxy that routes to demo when the flag is set. (This file is normally auto-generated; the wrapper lives in a sibling module `client-with-demo.ts` re-exported as `supabase` from `client.ts` — or if the file is protected, we import through a new `@/lib/supabase` shim and change hook imports. I'll confirm on read.)

### 2. UI changes
- `src/routes/login.tsx` — add "Try Demo Mode" button below sign-in that calls `enterDemoMode()`.
- New `src/components/DemoBanner.tsx` — sticky top banner "Demo Mode — changes are not saved" with "Reset Demo" and "Exit Demo" buttons. Mounted in `_authenticated.tsx` layout when demo flag is on.
- `src/routes/_authenticated.tsx` — bypass real auth check when in demo mode.

### 3. Seed data (`seed.ts`)
Realistic ~6 months of history for the Evergreen family:

- **species_catalog / breeds_catalog** — reuse existing static data (already in DB migrations; seed mirrors it).
- **pens** — 6 pens: Goat Barn, Pig Pasture, Chicken Coop, Duck Pond, Rabbit Hutch, Quarantine.
- **animals** — 22 total: 4 goats (2 does, 1 buck, 1 kid), 3 pigs, 8 chickens (1 rooster + 7 hens), 3 ducks, 2 dogs (LGDs), 2 cats (barn cats). Realistic names, birth dates, weights, tags.
- **pregnancies** — 2 records: 1 delivered (linked to litter), 1 active (goat, due in 3 weeks).
- **litters** — 1 kidding 2 months ago (2 kids), mother in `nursing` status with weaning countdown.
- **health_records** — vaccinations, dewormings, hoof trims across last 6 months (~15 entries).
- **heat_events / breeding_decisions** — a few for the goat doe.
- **feed_items** — 6: Layer Pellets, Goat Grain, Pig Grower, Duck Crumble, Alfalfa Hay, Dog Kibble.
- **feed_containers / feed_units / feed_container_stock** — 3 containers, standard units, stock rows.
- **feed_purchases** — ~12 over 6 months.
- **feed_logs** — ~120 daily entries across last 60 days.
- **production_logs** — daily egg counts (chickens 4–7/day, ducks 1–3/day) for 90 days → nice chart.
- **weight_logs** — monthly weigh-ins for pigs and goats.
- **chores + chore_completions** — 8 recurring chores, completions over 30 days.
- **tasks** — 6 open tasks, 10 completed.
- **bills** — 8 months of feed/vet/utilities, mix of paid/unpaid.
- **income_entries** — egg sales, kid sales, stud fees over 6 months.
- **barter_items / barter_deals / barter_contacts** — 2 contacts, 3 items, 2 deals.
- **contacts** — vet, feed store, neighbor.
- **compost_entries** — weekly for 3 months.
- **garden_plots** — 4 beds with plantings.
- **incubations** — 1 active duck hatch, 1 completed chicken hatch.
- **animal_events** — auto-generated from births, health records, weighings.
- **profiles / user_roles** — demo user as admin.

All timestamps are relative to `Date.now()` at seed time so the data always looks current.

### 4. Reports & charts
No code changes — existing Reports/Dashboard already read from these tables via TanStack Query. With the seed volume above, charts (egg trend, feed cost, income vs. bills) render meaningfully.

### 5. Guardrails
- Demo mode check happens inside the Proxy — impossible for a stray call to hit real Supabase.
- Server functions (createServerFn) are blocked in demo mode via a client-side check in `useServerFn` call sites for admin routes (or those routes hide themselves — simpler: the demo banner disables admin/backup pages).
- Reset button: `resetDemo()` re-runs `seed.ts` and reloads.
- Exit button: clears `demo_mode`, `demo_db`, navigates to `/login`.

## Non-goals / trade-offs

- The mock query builder implements the subset of PostgREST features the app actually uses today. If a hook later uses an unsupported filter (`.contains`, `.rpc`, `.textSearch`), it'll need to be added — I'll grep first and cover what exists.
- Realtime subscriptions are no-ops in demo.
- Storage (signed image URLs) — demo animals reference a small set of placeholder public images shipped with the app rather than signed Storage URLs.
- File edits to `src/integrations/supabase/client.ts` are normally forbidden. If confirmed protected, I'll add the Proxy in a new file and change the ~30 import sites to point at `@/lib/supabase`. I'll verify on the first read and adjust.

## Deliverable size
~10 new files, ~1 modified route (login), ~1 modified layout (_authenticated), plus either 1 client wrapper edit or a bulk import rename. Estimated 1500–2000 LOC, most of it the seed dataset.

Confirm and I'll build it.
