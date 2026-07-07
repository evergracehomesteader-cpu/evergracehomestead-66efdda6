# Multi-Homestead Support

Convert the app from a single shared homestead to a multi-tenant model where every user owns or belongs to one or more independent homesteads. All data is scoped to a homestead, and access is enforced by RLS.

## User-visible changes

- **Sign up is open.** Anyone can create an account. First sign-in creates a personal homestead automatically and makes them its owner.
- **Homestead switcher** in the sidebar header shows the current homestead name and lets users switch between ones they belong to.
- **New "Homestead" settings page** (owner-only):
  - Rename homestead
  - Invite people by email, assign a role (admin, manager, animal_care, helper, bookkeeper, viewer)
  - See pending invitations, resend or revoke
  - Remove members, change member roles
  - Transfer ownership, delete homestead
- **Invitations**: invitee gets an email link; opening it while signed in adds them to the homestead with the assigned role. If not signed in, they sign up first, then are auto-added.
- **Every page** (animals, feed, finance, chores, reports, etc.) shows only the currently selected homestead's data. Switching homesteads reloads all queries.
- Demo mode is unchanged and stays fully local.

## Data model

Add a `homesteads` table and a `homestead_members` join table. Move membership/roles off the global `user_roles` table and onto `homestead_members` so roles are per-homestead. Every existing data table gets a `homestead_id uuid not null` column with an index and RLS policies that require membership.

```text
homesteads(id, name, owner_id, created_at, updated_at)
homestead_members(homestead_id, user_id, role, created_at)   -- PK (homestead_id, user_id)
homestead_invitations(id, homestead_id, email, role, token, invited_by, expires_at, accepted_at)
```

All existing per-user data tables (animals, pens, feed_*, bills, income_entries, tasks, chores, chore_*, contacts, barter_*, garden_plots, compost_entries, production_logs, health_records, heat_events, pregnancies, litters, breeding_decisions, incubations, weight_logs, animal_events, backups) get:

- `homestead_id uuid not null references homesteads(id) on delete cascade`
- index on `homestead_id`
- RLS: `USING (public.is_homestead_member(homestead_id, auth.uid()))` for SELECT; write policies additionally check role via a `has_homestead_permission(homestead_id, permission)` security-definer function.

`user_roles` and `role_permissions` are kept but repurposed as **role templates** (permission catalog per role name); actual grants live in `homestead_members.role`.

## Backfill

One migration moves all existing rows into a single "Legacy Homestead" per current owner (first admin user), assigns homestead_id on every row, and adds every current user to that homestead with their current role. Nothing is lost.

## Application changes

- `src/lib/homestead-context.tsx`: React context holding `currentHomesteadId`, list of memberships, `setCurrent`, persisted in localStorage. Provider wraps `_authenticated`.
- `src/lib/supabase.ts` proxy stays; adds a helper `withHomestead(query)` that auto-injects `.eq("homestead_id", currentId)` on selects and sets `homestead_id` on inserts. Applied at each call site (opt-in) to keep changes reviewable; RLS is the true guarantee.
- `usePermissions` reads from `homestead_members` for the current homestead + `role_permissions` catalog.
- New routes:
  - `src/routes/_authenticated/homestead.tsx` — settings, members, invites
  - `src/routes/accept-invite.$token.tsx` (public) — accepts invite, then redirects
- Sidebar gets `<HomesteadSwitcher />`.
- Sign-up flow (email/password + Google) is enabled on `/login`; on first sign-in a trigger auto-creates a homestead named "{display_name}'s Homestead" and adds the user as owner.
- Every existing insert adds `homestead_id: currentHomesteadId`. Every list query filters by it. Queries invalidate on homestead switch.

## Security

- RLS on every table; no `TO anon` grants on tenant data.
- All membership/permission checks go through `security definer` functions to avoid recursive RLS.
- Invitation tokens are random 32-byte, single-use, 7-day expiry; accept flow verifies invitee email matches the invite.
- Owners cannot be removed; ownership transfer is an explicit action.
- Service role only used from server functions that verify the caller is an owner/admin of the target homestead.

## Rollout order

1. Migration: create tables, add `homestead_id` everywhere, backfill, replace policies, add helper functions.
2. Homestead context + switcher + first-login auto-create.
3. Update every query/insert to scope by homestead.
4. Homestead settings page + invitations + accept-invite route.
5. Update `usePermissions` and admin pages to per-homestead roles.
6. QA: verify a second account cannot see the first account's data.

## Scope note

This is a large change (~30 tables, ~40 files). It will be delivered in one migration + one code pass. Demo mode, PWA, and existing UX stay intact.
