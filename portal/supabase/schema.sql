-- Known Good Media parent portal: database + storage setup.
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run again.

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users on delete cascade,
  name text not null,
  sport text, position text, grad_year int, school text, number text,
  height text, weight text, gpa text, test_score text,
  details jsonb not null default '[]'::jsonb,   -- [{"label":"Exit Velo","value":"78 MPH"}]
  stats text, profile_link text,
  photo_path text,                               -- file in the "photos" bucket
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users on delete cascade,
  parent_email text,
  athlete_id uuid references public.athletes on delete set null,
  athlete jsonb,                                 -- snapshot of the athlete profile at order time
  package text not null,
  price int,
  rush boolean not null default false,
  film_links text[] not null default '{}',
  notes text, music text, team_color text,
  status text not null default 'submitted'
    check (status in ('submitted','paid','film_review','editing','review','revision','delivered')),
  history jsonb not null default '[]'::jsonb,
  paid boolean not null default false,
  payment_started boolean not null default false,
  reel_url text, vertical_url text,              -- links you share when the reel is ready
  revision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  parent_id uuid not null references auth.users on delete cascade,
  kind text not null default 'film' check (kind in ('film','delivery')),
  name text, size bigint, path text not null,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- new sign-ups get a profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- parents can't change status, payment or delivery fields; history is kept automatically
create or replace function public.guard_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'submitted'; new.paid := false; new.reel_url := null; new.vertical_url := null;
    else
      new.paid := old.paid; new.reel_url := old.reel_url; new.vertical_url := old.vertical_url;
      new.package := old.package; new.price := old.price;
      -- a parent may only move a draft in review to "revision" (request changes)
      if new.status is distinct from old.status and not (old.status = 'review' and new.status = 'revision') then
        new.status := old.status;
      end if;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.history := jsonb_build_array(jsonb_build_object('status', new.status, 'at', now()));
  elsif new.status is distinct from old.status then
    new.history := coalesce(old.history, '[]'::jsonb) || jsonb_build_object('status', new.status, 'at', now());
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before insert or update on public.orders
  for each row execute function public.guard_order();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.athletes enable row level security;
alter table public.orders enable row level security;
alter table public.order_files enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists "athletes rw" on public.athletes;
create policy "athletes rw" on public.athletes for all
  using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());

drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders for select using (parent_id = auth.uid() or public.is_admin());
drop policy if exists "orders insert" on public.orders;
create policy "orders insert" on public.orders for insert with check (parent_id = auth.uid());
drop policy if exists "orders update" on public.orders;
create policy "orders update" on public.orders for update
  using (parent_id = auth.uid() or public.is_admin()) with check (parent_id = auth.uid() or public.is_admin());

drop policy if exists "files rw" on public.order_files;
create policy "files rw" on public.order_files for all
  using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());

-- ---------- storage (private buckets; files live under <user id>/...) ----------
insert into storage.buckets (id, name, public) values ('photos','photos',false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('film','film',false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('deliveries','deliveries',false) on conflict (id) do nothing;

drop policy if exists "own uploads read" on storage.objects;
create policy "own uploads read" on storage.objects for select
  using (bucket_id in ('photos','film','deliveries')
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "own uploads write" on storage.objects;
create policy "own uploads write" on storage.objects for insert
  with check (bucket_id in ('photos','film')
              and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "own uploads update" on storage.objects;
create policy "own uploads update" on storage.objects for update
  using (bucket_id in ('photos','film') and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "admin deliveries" on storage.objects;
create policy "admin deliveries" on storage.objects for insert
  with check (bucket_id = 'deliveries' and public.is_admin());

-- ---------- make yourself the admin (after you sign in to the portal once) ----------
-- update public.profiles set is_admin = true where email = 'YOUR EMAIL';
