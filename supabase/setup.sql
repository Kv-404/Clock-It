-- Clock It: captures log + storage bucket.
-- Safe to run more than once.

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_url text not null,
  type text not null check (type in ('photo', 'video')),
  filter_name text,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists captures_user_created_idx
  on public.captures (user_id, created_at desc);

alter table public.captures enable row level security;

drop policy if exists "captures_select_own" on public.captures;
create policy "captures_select_own"
  on public.captures
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "captures_insert_own" on public.captures;
create policy "captures_insert_own"
  on public.captures
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "captures_delete_own" on public.captures;
create policy "captures_delete_own"
  on public.captures
  for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('captures', 'captures', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "captures_storage_read" on storage.objects;

drop policy if exists "captures_storage_insert_own" on storage.objects;
create policy "captures_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "captures_storage_update_own" on storage.objects;
create policy "captures_storage_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "captures_storage_delete_own" on storage.objects;
create policy "captures_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
