# Sets Supabase secrets (Resend + webhook secret) and writes SQL for the DB trigger.
# Run from PowerShell (double-click may not work — right-click → Run with PowerShell):
#   cd $HOME\Desktop\taxthechurch
#   powershell -ExecutionPolicy Bypass -File .\scripts\complete-supabase-welcome.ps1
#
# Or pass your Resend key (get it from resend.com):
#   powershell -ExecutionPolicy Bypass -File .\scripts\complete-supabase-welcome.ps1 -ResendApiKey "re_...."

param(
  [string]$ResendApiKey = "",
  [string]$FromEmail = "Tax the Church <updates@taxthe.church>",
  [string]$ProjectRef = "umouqdubdlqaofqukawa"
)

$ErrorActionPreference = "Stop"

$supabase = Join-Path $env:USERPROFILE "scoop\shims\supabase.exe"
if (-not (Test-Path $supabase)) {
  $supabase = "supabase"
}

if (-not $ResendApiKey) {
  $ResendApiKey = Read-Host "Paste your Resend API key (starts with re_)"
}

$ResendApiKey = $ResendApiKey.Trim()
if (-not $ResendApiKey) {
  Write-Error "Resend API key is required."
}

# URL-safe random secret (letters + digits)
$chars = [char[]]((48..57) + (65..90) + (97..122))
$webhookSecret = -join (1..64 | ForEach-Object { $chars | Get-Random })

Write-Host "Setting Supabase secrets..."
& $supabase secrets set --project-ref $ProjectRef `
  "RESEND_API_KEY=$ResendApiKey" `
  "FROM_EMAIL=$FromEmail" `
  "SIGNUP_WEBHOOK_SECRET=$webhookSecret"

if ($LASTEXITCODE -ne 0) {
  Write-Error "supabase secrets set failed. Are you logged in? (supabase login)"
}

$sqlPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "member_signup_run_in_supabase_sql_editor.sql"

# PostgreSQL uses $$ for function bodies; PowerShell would expand $$ as process id — use a literal delimiter.
$delim = [string]::new([char[]](36, 36))

$sql = @"
-- Paste this ENTIRE file into: Supabase Dashboard -> SQL -> New query -> Run
-- (Do not run in PowerShell.)

create extension if not exists pg_net;

create or replace function public.notify_member_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $delim
begin
  perform net.http_post(
    url := 'https://$ProjectRef.supabase.co/functions/v1/send-welcome',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-signup-secret', '$($webhookSecret -replace "'", "''")'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$delim;

drop trigger if exists trg_member_signup_welcome on public.members;
create trigger trg_member_signup_welcome
after insert on public.members
for each row execute function public.notify_member_signup();
"@

Set-Content -Path $sqlPath -Value $sql -Encoding UTF8

Write-Host ""
Write-Host "Done."
Write-Host "1) Open Supabase Dashboard -> SQL -> New query."
Write-Host "2) Open this file in Notepad and copy ALL of it:"
Write-Host "   $sqlPath"
Write-Host "3) Paste into SQL editor and click Run."
Write-Host ""
Write-Host "Redeploy function if you changed nothing else: already on server from last deploy."
