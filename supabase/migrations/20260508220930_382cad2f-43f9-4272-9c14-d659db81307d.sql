
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_auth" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Animals
create type public.animal_sex as enum ('female','male','unknown');
create type public.animal_status as enum ('active','sold','deceased','archived');

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null,
  breed text,
  sex public.animal_sex not null default 'unknown',
  date_of_birth date,
  tag text,
  status public.animal_status not null default 'active',
  photo_url text,
  notes text,
  mother_id uuid references public.animals(id) on delete set null,
  father_id uuid references public.animals(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger animals_updated before update on public.animals for each row execute function public.set_updated_at();
alter table public.animals enable row level security;
create policy "animals_all_auth" on public.animals for all to authenticated using (true) with check (true);

-- Heat events
create table public.heat_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  event_date date not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.heat_events enable row level security;
create policy "heats_all_auth" on public.heat_events for all to authenticated using (true) with check (true);

-- Pregnancies
create type public.pregnancy_status as enum ('active','born','lost');
create table public.pregnancies (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  sire_id uuid references public.animals(id) on delete set null,
  bred_date date not null,
  expected_due date,
  actual_birth date,
  offspring_count int,
  status public.pregnancy_status not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger preg_updated before update on public.pregnancies for each row execute function public.set_updated_at();
alter table public.pregnancies enable row level security;
create policy "preg_all_auth" on public.pregnancies for all to authenticated using (true) with check (true);

-- Feed items
create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text,
  price_cents int,
  unit text not null default 'lb',
  stock_qty numeric not null default 0,
  low_stock_threshold numeric not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger feed_items_updated before update on public.feed_items for each row execute function public.set_updated_at();
alter table public.feed_items enable row level security;
create policy "feed_items_all_auth" on public.feed_items for all to authenticated using (true) with check (true);

-- Feed purchases (price history, also adds to stock)
create table public.feed_purchases (
  id uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  store text,
  price_cents int not null,
  quantity numeric not null,
  purchased_on date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.feed_purchases enable row level security;
create policy "feed_pur_all_auth" on public.feed_purchases for all to authenticated using (true) with check (true);

-- Feed log
create table public.feed_logs (
  id uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  animal_id uuid references public.animals(id) on delete set null,
  quantity numeric not null,
  fed_on date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.feed_logs enable row level security;
create policy "feed_logs_all_auth" on public.feed_logs for all to authenticated using (true) with check (true);

-- Garden
create table public.garden_plots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  crop text,
  planted_on date,
  expected_harvest date,
  status text not null default 'growing',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger garden_updated before update on public.garden_plots for each row execute function public.set_updated_at();
alter table public.garden_plots enable row level security;
create policy "garden_all_auth" on public.garden_plots for all to authenticated using (true) with check (true);

-- Compost
create table public.compost_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null default 'add',
  material text,
  quantity text,
  entry_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.compost_entries enable row level security;
create policy "compost_all_auth" on public.compost_entries for all to authenticated using (true) with check (true);

-- Bills
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  amount_cents int not null default 0,
  due_date date,
  paid boolean not null default false,
  paid_on date,
  recurring text not null default 'none',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bills_updated before update on public.bills for each row execute function public.set_updated_at();
alter table public.bills enable row level security;
create policy "bills_all_auth" on public.bills for all to authenticated using (true) with check (true);
