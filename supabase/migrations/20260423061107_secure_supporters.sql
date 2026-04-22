-- Enable RLS
alter table public.supporters enable row level security;

-- Remove public access
revoke all on public.supporters from anon;
revoke all on public.supporters from authenticated;

-- Allow insert ONLY via service role (edge functions)
create policy "Service role insert"
on public.supporters
for insert
to service_role
using (true);

-- Block everything else
create policy "No public select"
on public.supporters
for select
to anon, authenticated
using (false);
