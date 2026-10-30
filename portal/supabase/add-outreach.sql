-- Recruiting outreach add-on (corrected Oct 30, 2026). Same as fix-order-guard.sql.
-- Fix: saving an order (status, payment, reel links) fails, and so can new orders and Stripe's "paid" update.
-- Cause: add-outreach.sql rebuilt the order guard with public.is_admin(), which advisor-fixes.sql had removed.
-- Run once in Supabase > SQL Editor. Safe to run again.

alter table public.orders add column if not exists outreach text;
alter table public.orders add column if not exists outreach_followup boolean not null default false;

-- parents can't change status, payment, delivery or price fields; the owner and the Stripe webhook can.
-- history is kept automatically.
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
      new.outreach := old.outreach; new.outreach_followup := old.outreach_followup;
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
revoke execute on function public.guard_order() from public, anon, authenticated;

drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before insert or update on public.orders
  for each row execute function public.guard_order();
