-- Known Good Media portal: clean-up for the Supabase Advisors (Security + Performance).
-- Run once in Supabase > SQL Editor. Safe to run again. Nothing here changes who can see or do what.

-- ---------- Security: move is_admin() out of the public API ----------
-- Access rules still need it, but it no longer shows up as a callable function in the API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

-- ---------- Performance: index the foreign keys ("Unindexed foreign keys") ----------
create index if not exists athletes_parent_id_idx    on public.athletes (parent_id);
create index if not exists orders_parent_id_idx      on public.orders (parent_id);
create index if not exists orders_athlete_id_idx     on public.orders (athlete_id);
create index if not exists order_files_order_id_idx  on public.order_files (order_id);
create index if not exists order_files_parent_id_idx on public.order_files (parent_id);

-- ---------- Performance: evaluate auth checks once per query, not once per row ("Auth RLS initplan") ----------
-- Same rules as before; auth.uid() and is_admin() are just wrapped in (select ...).
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "athletes rw" on public.athletes;
create policy "athletes rw" on public.athletes for all to authenticated
  using (parent_id = (select auth.uid()) or (select private.is_admin()))
  with check (parent_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders for select to authenticated
  using (parent_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "orders insert" on public.orders;
create policy "orders insert" on public.orders for insert to authenticated
  with check (parent_id = (select auth.uid()));
drop policy if exists "orders update" on public.orders;
create policy "orders update" on public.orders for update to authenticated
  using (parent_id = (select auth.uid()) or (select private.is_admin()))
  with check (parent_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "orders delete" on public.orders;
create policy "orders delete" on public.orders for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists "files rw" on public.order_files;
create policy "files rw" on public.order_files for all to authenticated
  using (parent_id = (select auth.uid()) or (select private.is_admin()))
  with check (parent_id = (select auth.uid()) or (select private.is_admin()));

-- Storage: one insert policy instead of two ("Multiple permissive policies"), same rules.
drop policy if exists "own uploads read" on storage.objects;
create policy "own uploads read" on storage.objects for select to authenticated
  using (bucket_id in ('photos','film','deliveries')
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
drop policy if exists "own uploads write" on storage.objects;
drop policy if exists "admin deliveries" on storage.objects;
drop policy if exists "uploads insert" on storage.objects;
create policy "uploads insert" on storage.objects for insert to authenticated
  with check (
    (bucket_id in ('photos','film') and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())))
    or (bucket_id = 'deliveries' and (select private.is_admin()))
  );
drop policy if exists "own uploads update" on storage.objects;
create policy "own uploads update" on storage.objects for update to authenticated
  using (bucket_id in ('photos','film') and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
drop policy if exists "admin delete uploads" on storage.objects;
create policy "admin delete uploads" on storage.objects for delete to authenticated
  using (bucket_id in ('film','deliveries') and (select private.is_admin()));

-- ---------- Security: the order guard uses the private check; trigger functions not callable from the API ----------
create or replace function public.guard_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.status := 'submitted'; new.paid := false; new.reel_url := null; new.vertical_url := null;
      new.paid_amount := null; new.stripe_session := null;
    else
      new.paid := old.paid; new.reel_url := old.reel_url; new.vertical_url := old.vertical_url;
      new.package := old.package; new.price := old.price;
      new.paid_amount := old.paid_amount; new.stripe_session := old.stripe_session;
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
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_order()     from public, anon, authenticated;

-- Nothing uses the old public check any more.
drop function if exists public.is_admin();
