alter table public.members
add column if not exists day7_sent boolean default false;

update public.members
set day7_sent = false
where day7_sent is null;
