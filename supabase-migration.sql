-- ═══════════════════════════════════════════════════════════════
-- Keno Vault — Supabase SQL Migration v2
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com → Your Project → SQL Editor
-- 2. Click "New query"
-- 3. Paste this entire file and click "Run"
-- ═══════════════════════════════════════════════════════════════

-- ── ASSETS TABLE (with depreciation columns) ──────────────────
create table if not exists assets (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  cat              text not null check (cat in ('cash','physical','investment','liability')),
  value            numeric not null default 0,
  notes            text,
  principal        numeric,
  rate             numeric,
  years            numeric,
  fv               numeric default 0,
  interest         numeric default 0,
  -- Depreciation engine columns (Pro)
  depreciation_type   text check (depreciation_type in ('straight-line','reducing-balance') or depreciation_type is null),
  depreciation_rate   numeric,
  useful_life         numeric,
  salvage_value       numeric,
  original_cost       numeric,
  depreciation_start  timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── NET WORTH HISTORY TABLE ───────────────────────────────────
create table if not exists nw_history (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  nw         numeric not null,
  label      text not null,
  created_at timestamptz default now()
);

-- ── SUBSCRIPTIONS TABLE ───────────────────────────────────────
create table if not exists subscriptions (
  id                       uuid default gen_random_uuid() primary key,
  user_id                  uuid references auth.users(id) on delete cascade,
  email                    text,
  plan                     text default 'free' check (plan in ('free','growth','pro')),
  status                   text default 'active' check (status in ('active','inactive','cancelled','expired')),
  provider                 text default 'manual',
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_end       timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table assets       enable row level security;
alter table nw_history   enable row level security;
alter table subscriptions enable row level security;

-- Drop existing policies if they exist (safe re-run)
drop policy if exists "assets_own"        on assets;
drop policy if exists "nw_history_own"    on nw_history;
drop policy if exists "subscriptions_own" on subscriptions;
drop policy if exists "subscriptions_admin_read" on subscriptions;

-- Users can only read/write their own assets
create policy "assets_own" on assets
  for all using (auth.uid() = user_id);

-- Users can only read/write their own history
create policy "nw_history_own" on nw_history
  for all using (auth.uid() = user_id);

-- Users can read their own subscription (by user_id or email)
create policy "subscriptions_own" on subscriptions
  for select using (
    auth.uid() = user_id
    or email = (select email from auth.users where id = auth.uid())
  );

-- Admin can insert/update subscriptions (for manual activation)
-- Restricted to the admin email — only kenovault@gmail.com can write
-- ⚠️ For existing deployments: re-run this block in Supabase SQL Editor
create policy "subscriptions_admin_write" on subscriptions
  for all using (
    auth.email() = 'kenovault@gmail.com'
  );

-- ── INDEXES ───────────────────────────────────────────────────
create index if not exists assets_user_id_idx       on assets(user_id);
create index if not exists assets_cat_idx           on assets(cat);
create index if not exists assets_created_at_idx    on assets(created_at);
create index if not exists nw_history_user_id_idx   on nw_history(user_id);
create index if not exists nw_history_created_idx   on nw_history(created_at);
create index if not exists subscriptions_email_idx  on subscriptions(email);
create index if not exists subscriptions_user_id_idx on subscriptions(user_id);

-- ── ADD MISSING COLUMNS (safe for existing tables) ───────────
alter table subscriptions add column if not exists email       text;
alter table subscriptions add column if not exists updated_at  timestamptz default now();
alter table assets        add column if not exists depreciation_type  text;
alter table assets        add column if not exists depreciation_rate  numeric;
alter table assets        add column if not exists useful_life        numeric;
alter table assets        add column if not exists salvage_value      numeric;
alter table assets        add column if not exists original_cost      numeric;
alter table assets        add column if not exists depreciation_start timestamptz;
alter table assets        add column if not exists updated_at         timestamptz default now();

-- ── AUTO-UPDATE updated_at TRIGGER ───────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists assets_updated_at       on assets;
drop trigger if exists subscriptions_updated_at on subscriptions;

create trigger assets_updated_at
  before update on assets
  for each row execute function update_updated_at_column();

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at_column();

-- ── GOALS TABLE (Growth tier) ─────────────────────────────────
create table if not exists goals (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  target_amount    numeric not null default 0,
  current_amount   numeric default 0,
  deadline         timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── AUDIT LOG TABLE (Growth tier) ─────────────────────────────
create table if not exists audit_log (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  action       text not null,
  entity_type  text,
  entity_name  text,
  details      text,
  created_at   timestamptz default now()
);

-- RLS for new tables
alter table goals     enable row level security;
alter table audit_log enable row level security;

create policy "goals_own" on goals
  for all using (auth.uid() = user_id);
create policy "audit_log_own" on audit_log
  for select using (auth.uid() = user_id);
create policy "audit_log_insert" on audit_log
  for insert with check (auth.uid() = user_id);

-- Indexes
create index if not exists goals_user_id_idx    on goals(user_id);
create index if not exists audit_log_user_idx   on audit_log(user_id);
create index if not exists audit_log_created_idx on audit_log(created_at);

-- ── CUSTOM CATEGORIES (Growth tier) ───────────────────────────
alter table assets add column if not exists custom_cat text;

-- ── VERIFY ───────────────────────────────────────────────────
-- After running, you should see these tables:
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;

-- Expected output:
-- assets
-- audit_log
-- goals
-- nw_history
-- subscriptions