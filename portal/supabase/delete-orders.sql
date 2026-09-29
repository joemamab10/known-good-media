-- Run once in Supabase → SQL Editor. Lets the owner (admin) delete orders from the portal.
-- Deleting an order also removes its order_files rows (on delete cascade).

drop policy if exists "orders delete" on public.orders;
create policy "orders delete" on public.orders for delete using (public.is_admin());

-- Let the owner remove an order's uploaded film and delivery files from storage.
drop policy if exists "admin delete uploads" on storage.objects;
create policy "admin delete uploads" on storage.objects for delete
  using (bucket_id in ('film','deliveries') and public.is_admin());
