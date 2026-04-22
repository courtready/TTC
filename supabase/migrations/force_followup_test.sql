update public.members 
set created_at = now() - interval '97 hours'
where followup_sent = false;
