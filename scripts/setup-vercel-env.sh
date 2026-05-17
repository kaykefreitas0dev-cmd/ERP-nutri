#!/usr/bin/env bash
# Bulk add Vercel env vars to all 3 NutriCore apps
# Uses `vercel env add` per app dir (CLI authenticated via earlier `vercel login`)
#
# Vars per app:
# web/marketing/patient: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, NEXT_PUBLIC_STATUS_API_URL (marketing only)
# web only: SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, DIRECT_URL, EMAIL_PROVIDER

set -e

ROOT="C:/Users/kamila/Documents/ERP nutri"
VERCEL="$APPDATA/npm/vercel.cmd"

# Source env values
SUPABASE_URL="https://uzhqlfgwcummukyfriez.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aHFsZmd3Y3VtbXVreWZyaWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODE0NDAsImV4cCI6MjA5NDU1NzQ0MH0.eD9_V65xIujfcQDGfGKevprccoUsjhkcd9wImWs1Zmo"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aHFsZmd3Y3VtbXVreWZyaWV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk4MTQ0MCwiZXhwIjoyMDk0NTU3NDQwfQ.2FTiuYszxtD_FYjv4NRQ6nRvNVujDYgAjoogD8SIPEc"
DATABASE_URL="postgresql://postgres.uzhqlfgwcummukyfriez:Kaka25126587%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.uzhqlfgwcummukyfriez:Kaka25126587%40@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
SANITY_PROJECT_ID="p61sxa53"
SANITY_DATASET="production"

add_var() {
  local app=$1
  local name=$2
  local value=$3
  local env=$4  # production, preview, development
  cd "$ROOT/apps/$app"
  # Remove existing first (idempotent), then add
  echo "$value" | "$VERCEL" env add "$name" "$env" --yes 2>&1 | tail -2 || true
  cd "$ROOT"
}

for app in web marketing patient; do
  echo "=== Setting env vars for apps/$app ==="
  for env in production preview development; do
    add_var "$app" "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL" "$env"
    add_var "$app" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" "$env"
    add_var "$app" "NEXT_PUBLIC_SANITY_PROJECT_ID" "$SANITY_PROJECT_ID" "$env"
    add_var "$app" "NEXT_PUBLIC_SANITY_DATASET" "$SANITY_DATASET" "$env"
  done
done

# web-only: server-side secrets
echo "=== Setting web-only server vars ==="
for env in production preview development; do
  add_var "web" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "$env"
  add_var "web" "DATABASE_URL" "$DATABASE_URL" "$env"
  add_var "web" "DIRECT_URL" "$DIRECT_URL" "$env"
  add_var "web" "EMAIL_PROVIDER" "resend" "$env"
done

# marketing: needs DATABASE_URL too for pricing-plans page (consumes own API)
echo "=== Setting marketing extra vars ==="
for env in production preview development; do
  add_var "marketing" "DATABASE_URL" "$DATABASE_URL" "$env"
  add_var "marketing" "NEXT_PUBLIC_STATUS_API_URL" "https://erp-nutri-web.vercel.app/api/public/status" "$env"
done

echo "✅ Done. Verify with: vercel env ls (in each app dir)"
