-- Adds the team nickname / mascot ("Maroons") to athlete profiles. Run once in Supabase > SQL Editor,
-- BEFORE pushing the portal update that asks for it. Safe to run again.
alter table public.athletes add column if not exists mascot text;
