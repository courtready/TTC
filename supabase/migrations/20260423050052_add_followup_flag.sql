alter table public.members 
add column if not exists followup_sent boolean default false;

update public.members 
set followup_sent = false 
where followup_sent is null;
