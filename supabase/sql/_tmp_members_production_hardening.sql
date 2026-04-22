create extension if not exists pgcrypto;

alter table public.members
  alter column id set default gen_random_uuid(),
  alter column created_at set default now(),
  alter column consent set default true;

update public.members
set first_name = coalesce(nullif(trim(first_name), ''), 'Member')
where first_name is null or trim(first_name) = '';

update public.members
set email = lower(trim(email))
where email is not null;

delete from public.members a
using public.members b
where a.id > b.id
  and lower(a.email) = lower(b.email)
  and a.email is not null
  and b.email is not null;

alter table public.members
  alter column first_name set not null,
  alter column email set not null;

alter table public.members add column if not exists postcode text;
alter table public.members add column if not exists followup_sent boolean;

create unique index if not exists members_email_unique_idx
on public.members (lower(email));

alter table public.members enable row level security;

drop policy if exists "Allow public insert" on public.members;
create policy "Allow public insert"
on public.members
for insert
to anon
with check (true);
