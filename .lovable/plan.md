# Phase B build plan

Four independent pieces; shipping them in one pass. Permissions are already role-based and admin-configurable from Phase A — no changes needed there beyond gating the new UI.

## 1. Full PWA with service worker

- Add `vite-plugin-pwa` and wire it via the Lovable Vite config's extension point.
- `registerType: "autoUpdate"`, `devOptions.enabled: false`, `NetworkFirst` for HTML navigations, `navigateFallbackDenylist` for `/~oauth` and `/api/*`.
- Registration guard in `src/main.tsx` / entry: skip when in iframe or on `id-preview--*` / `lovableproject.com` hosts; auto-unregister any existing SW there.
- Keep existing `public/manifest.webmanifest` (already standalone, themed).
- Warn: PWA install/offline only works on the published `evergracehomestead.lovable.app`, not in the editor preview.

## 2. Chores feature (separate from Tasks)

DB already has `chores`, `chore_assignments`, `chore_completions` with the right RLS. No migration needed.

New page `src/routes/_authenticated/chores.tsx`:
- **Today view** (default): every active chore whose recurrence matches today, grouped by assignee (or "Unassigned"). Tap to mark complete → inserts a `chore_completions` row for today.
- **All chores** tab: list of chore definitions with category, recurrence summary, assignee avatars.
- **New / edit chore dialog** (admin/manager only, via `usePermissions().can("chores.create" / "chores.edit")`):
  - title, notes, category
  - recurrence: `daily` | `weekly` (pick days_of_week) | `monthly` (day_of_month) — Simple, as requested
  - optional due_time, start_date, end_date, active toggle
  - **multiple assignees**: multi-select of profiles, written to `chore_assignments` (one row per user)
- Sidebar entry: "Chores" (calendar-check icon), gated on `chores.view`.

Permission keys already exist in `src/lib/permissions.ts` (`chores.view`, `chores.create`, `chores.edit`, `chores.complete`, `chores.view.assigned`). Helpers role default perms get seeded for the new role if missing.

## 3. Per-table selective restore

New admin page `src/routes/_authenticated/admin.backups.tsx` (admin-only).

- Lists rows from `backups` table with label, created_at, size, table counts (already stored as jsonb).
- **Create backup** button → server fn `createBackup` (admin-only, uses `supabaseAdmin`): dumps a configurable set of tables to JSON, uploads to existing `backups` storage bucket, inserts a `backups` row with per-table row counts.
- **Restore dialog** per backup: checklist of tables present in the backup → server fn `restoreBackup({ backupId, tables: string[], mode: "replace" | "merge" })`:
  - `replace`: `DELETE FROM <table>` then bulk insert from JSON.
  - `merge`: upsert by `id`.
  - Runs only the tables the admin ticked → that's the "per-table selective restore".
- Whitelist of restorable tables on the server (no `auth.*`, no `storage.*`, no `user_roles` / `role_permissions` unless explicitly opted in — those are dangerous).

## 4. Wiring

- Add sidebar links for Chores (everyone with `chores.view`) and Backups (admin only).
- No changes to existing Tasks page — it stays for one-time / project work as requested.

## Technical notes

- Server fns live in `src/lib/chores.functions.ts` (none strictly needed for chores — RLS covers it) and `src/lib/backups.functions.ts` (needs `supabaseAdmin` for cross-table writes).
- All new tables? None. All four pieces use existing schema.
- PWA SW kill-switch already irrelevant (no prior SW shipped).
