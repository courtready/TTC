-- Run this ONLY in Supabase Dashboard → SQL Editor → New query → Run.
-- Do NOT paste into PowerShell.

create extension if not exists pg_net;

-- Replace YOUR_SIGNUP_SECRET with the SAME string you set as SIGNUP_WEBHOOK_SECRET in:
-- supabase secrets set ... SIGNUP_WEBHOOK_SECRET="..."
create or replace function public.notify_member_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://umouqdubdlqaofqukawa.supabase.co/functions/v1/send-welcome',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-signup-secret', 'YOUR_SIGNUP_SECRET'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists trg_member_signup_welcome on public.members;
create trigger trg_member_signup_welcome
after insert on public.members
for each row execute function public.notify_member_signup();
