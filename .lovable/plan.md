# Implementation Plan

Three big features. I'll ship them in this order so each is testable on its own.

---

## 1. Full PWA with service worker

**Heads up:** Service workers don't work in the Lovable editor preview (iframe) and can cause stale-cache issues there. The setup below disables the SW in dev/preview/iframe contexts and only activates it on the published site (`evergracehomestead.lovable.app`). You'll need to publish to test offline behavior.

What I'll add:
- `vite-plugin-pwa` with `registerType: "autoUpdate"`, `devOptions.enabled: false`
- App-shell precaching (HTML, JS, CSS, icons)
- Runtime caching: `NetworkFirst` for HTML navigations (3s timeout), `StaleWhileRevalidate` for Supabase GET reads, `CacheFirst` for images/fonts
- Offline fallback route at `/offline` shown when navigation fails
- Update prompt: small toast "New version available — Reload" when a new SW is ready
- Guarded registration in `src/main.tsx` (skips iframes + preview hosts, unregisters any existing SWs there)
- Online/offline status banner (top of layout) so weak-signal users get feedback

## 2. Chores section (separate from Tasks)

New tables:
- `chores` — title, notes, category, recurrence (`daily`/`weekly`/`monthly`/`once`), `days_of_week int[]` (for weekly), `due_time` (time of day), `created_by`, timestamps
- `chore_assignments` — `chore_id`, `user_id` (multi-assignee join)
- `chore_completions` — `chore_id`, `instance_date`, `completed_by`, `completed_at`, `notes` (one row per occurrence completed)

Recurrence model:
- "Today's chores" view computes which chores are due today from recurrence + days_of_week
- A chore is "done today" when a `chore_completions` row exists for `(chore_id, today)`
- Anyone assigned (or admin/manager) can mark it done

New routes:
- `/chores` — Today / Upcoming / All tabs, filter by assignee + category
- `/chores/manage` — admin/manager: create/edit/delete chores, assign users
- Sidebar entry between Tasks and Calendar

Permissions (uses existing `role_permissions`):
- `chores.view` — admin, manager, helper, viewer
- `chores.complete` — admin, manager, helper (assigned only for helper)
- `chores.manage` — admin, manager
- New permission rows seeded in a migration

## 3. Backup & Restore (admin-only)

New table `backups`:
- `id`, `created_at`, `created_by`, `label`, `size_bytes`, `table_counts jsonb`, `storage_path`

Backup flow:
- Admin clicks "Create backup" on `/admin/backups`
- Server function `createBackup` (admin-only middleware) reads every public table, writes JSON to a private `backups` storage bucket, inserts a `backups` row
- History list shows label, date, size, row counts; each row has Download + Restore + Delete

Restore flow (per-table selective):
- Admin clicks Restore on a backup → modal lists every table in the backup with a checkbox + current row count vs backup row count
- Big red warning: "This will DELETE all rows in selected tables and replace them with backup data. Type RESTORE to confirm."
- Server function `restoreBackup` (admin-only) takes `backup_id` + `tables[]`, runs in a transaction per table: `DELETE FROM <t>; INSERT ...`
- Restricted to a safe allow-list of tables (excludes `user_roles`, `role_permissions`, `profiles`, `backups` itself to prevent self-lockout)

New files:
- `src/lib/backup.functions.ts`, `src/lib/restore.functions.ts`
- `src/routes/_authenticated/admin.backups.tsx`
- Sidebar entry under Admin

## Technical Notes

- All server functions use `requireSupabaseAuth` + an `isAdmin` check inside the handler (same pattern as `admin-users.functions.ts`)
- Migration adds `chores`, `chore_assignments`, `chore_completions`, `backups` tables with proper GRANTs and RLS (admin/manager write, assignees read their chores)
- Storage bucket `backups` is private; downloads use signed URLs
- PWA work touches `vite.config.ts`, `src/main.tsx` (or equivalent client entry), adds `public/offline.html` + `src/routes/offline.tsx`
- Won't change auth, existing tables, or unrelated routes

## Out of scope

- Push notifications for chore reminders (separate request)
- Automatic scheduled backups (manual only for now)
- Restoring `user_roles` / `profiles` (locked out to prevent admin self-lockout — can revisit)

Total: ~1 migration, ~12 new files, ~4 edited files. Will ship as one large change.
