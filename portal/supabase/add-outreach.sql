-- Recruiting outreach add-on. Run once in Supabase > SQL Editor BEFORE pushing the portal update.
alter table public.orders add column if not exists outreach text;
alter table public.orders add column if not exists outreach_followup boolean not null default false;

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
      new.outreach := old.outreach; new.outreach_followup := old.outreach_followup;
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
