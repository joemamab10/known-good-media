-- Run once in Supabase → SQL Editor. Lets the Stripe webhook mark orders paid automatically.

alter table public.orders add column if not exists paid_amount numeric;
alter table public.orders add column if not exists stripe_session text;

-- The webhook runs with the service role (not a signed-in admin), so let it through the guard.
create or replace function public.guard_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
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
