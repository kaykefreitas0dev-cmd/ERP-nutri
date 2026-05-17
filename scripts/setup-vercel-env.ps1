# Batch setup Vercel env vars for the 3 NutriCore apps
# Run from repo root: pwsh ./scripts/setup-vercel-env.ps1

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";$env:APPDATA\npm"
$ROOT = "C:\Users\kamila\Documents\ERP nutri"
$VERCEL = "$env:APPDATA\npm\vercel.cmd"

$SUPABASE_URL = "https://uzhqlfgwcummukyfriez.supabase.co"
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aHFsZmd3Y3VtbXVreWZyaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODE0NDAsImV4cCI6MjA5NDU1NzQ0MH0.eD9_V65xIujfcQDGfGKevprccoUsjhkcd9wImWs1Zmo"
$SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aHFsZmd3Y3VtbXVreWZyaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk4MTQ0MCwiZXhwIjoyMDk0NTU3NDQwfQ.2FTiuYszxtD_FYjv4NRQ6nRvNVujDYgAjoogD8SIPEc"
$DATABASE_URL = "postgresql://postgres.uzhqlfgwcummukyfriez:Kaka25126587%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
$DIRECT_URL = "postgresql://postgres.uzhqlfgwcummukyfriez:Kaka25126587%40@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
$SANITY_PROJECT_ID = "p61sxa53"
$SANITY_DATASET = "production"
$STATUS_API_URL = "https://erp-nutri-web.vercel.app/api/public/status"

function Add-VercelEnv {
  param([string]$App, [string]$Name, [string]$Value, [string]$Env)
  Push-Location "$ROOT\apps\$App"
  Write-Host "  [$App/$Env] $Name" -ForegroundColor DarkGray
  $Value | & $VERCEL env add $Name $Env --force --yes 2>&1 | Out-Null
  Pop-Location
}

# Public vars in all 3 apps
foreach ($app in @("web","marketing","patient")) {
  Write-Host "=== apps/$app (public vars) ===" -ForegroundColor Cyan
  foreach ($env in @("production","preview","development")) {
    Add-VercelEnv -App $app -Name "NEXT_PUBLIC_SUPABASE_URL" -Value $SUPABASE_URL -Env $env
    Add-VercelEnv -App $app -Name "NEXT_PUBLIC_SUPABASE_ANON_KEY" -Value $SUPABASE_ANON_KEY -Env $env
    Add-VercelEnv -App $app -Name "NEXT_PUBLIC_SANITY_PROJECT_ID" -Value $SANITY_PROJECT_ID -Env $env
    Add-VercelEnv -App $app -Name "NEXT_PUBLIC_SANITY_DATASET" -Value $SANITY_DATASET -Env $env
  }
}

# Web-only server vars
Write-Host "=== apps/web (server vars) ===" -ForegroundColor Cyan
foreach ($env in @("production","preview","development")) {
  Add-VercelEnv -App "web" -Name "SUPABASE_SERVICE_ROLE_KEY" -Value $SUPABASE_SERVICE_ROLE_KEY -Env $env
  Add-VercelEnv -App "web" -Name "DATABASE_URL" -Value $DATABASE_URL -Env $env
  Add-VercelEnv -App "web" -Name "DIRECT_URL" -Value $DIRECT_URL -Env $env
  Add-VercelEnv -App "web" -Name "EMAIL_PROVIDER" -Value "resend" -Env $env
}

# Marketing extra: precisa DATABASE_URL (consome próprio API status local) + URL pública status
Write-Host "=== apps/marketing (extra vars) ===" -ForegroundColor Cyan
foreach ($env in @("production","preview","development")) {
  Add-VercelEnv -App "marketing" -Name "DATABASE_URL" -Value $DATABASE_URL -Env $env
  Add-VercelEnv -App "marketing" -Name "NEXT_PUBLIC_STATUS_API_URL" -Value $STATUS_API_URL -Env $env
}

Write-Host "`n✅ Done. Verify with 'vercel env ls' in each app dir." -ForegroundColor Green
