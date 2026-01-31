#!/bin/bash
#
# Environment Setup Verification Script
# Checks Railway, Vercel, Doppler, Neon, and GitHub configurations
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_section() {
  echo ""
  echo -e "${YELLOW}▶ $1${NC}"
  echo "───────────────────────────────────────────────────────────────"
}

pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASS++))
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((FAIL++))
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
  ((WARN++))
}

info() {
  echo -e "  ${BLUE}ℹ${NC} $1"
}

check_command() {
  if command -v "$1" &> /dev/null; then
    return 0
  else
    return 1
  fi
}

# ============================================================================
# CLI AVAILABILITY CHECKS
# ============================================================================
print_header "CLI Tools Availability"

print_section "Required CLIs"

if check_command doppler; then
  pass "Doppler CLI installed: $(doppler --version 2>/dev/null | head -1)"
else
  fail "Doppler CLI not installed (brew install dopplerhq/cli/doppler)"
fi

if check_command vercel; then
  pass "Vercel CLI installed: $(vercel --version 2>/dev/null)"
else
  fail "Vercel CLI not installed (npm i -g vercel)"
fi

if check_command railway; then
  pass "Railway CLI installed: $(railway --version 2>/dev/null)"
else
  fail "Railway CLI not installed (npm i -g @railway/cli)"
fi

if check_command neonctl; then
  pass "Neon CLI installed: $(neonctl --version 2>/dev/null)"
else
  warn "Neon CLI not installed (npm i -g neonctl) - optional but recommended"
fi

if check_command gh; then
  pass "GitHub CLI installed: $(gh --version 2>/dev/null | head -1)"
else
  fail "GitHub CLI not installed (brew install gh)"
fi

# ============================================================================
# DOPPLER CONFIGURATION
# ============================================================================
print_header "Doppler Configuration"

print_section "Doppler Configs"

DOPPLER_CONFIGS=$(doppler configs --json 2>/dev/null || echo "[]")
if [ "$DOPPLER_CONFIGS" != "[]" ]; then
  for config in dev dev_personal preview prod; do
    if echo "$DOPPLER_CONFIGS" | grep -q "\"name\":\"$config\""; then
      pass "Config '$config' exists"
    else
      fail "Config '$config' missing"
    fi
  done
else
  fail "Could not fetch Doppler configs (not logged in?)"
fi

print_section "Doppler Secret Comparison (preview vs prod)"

echo ""
echo "  Checking if preview and prod have DIFFERENT values (they should):"
echo ""

# Get secrets for comparison
PREVIEW_WS=$(doppler secrets get NEXT_PUBLIC_LH_PARTY_WS_URL --config preview --plain 2>/dev/null || echo "ERROR")
PROD_WS=$(doppler secrets get NEXT_PUBLIC_LH_PARTY_WS_URL --config prod --plain 2>/dev/null || echo "ERROR")
PREVIEW_DB=$(doppler secrets get LH_PARTY_DATABASE_URL --config preview --plain 2>/dev/null || echo "ERROR")
PROD_DB=$(doppler secrets get LH_PARTY_DATABASE_URL --config prod --plain 2>/dev/null || echo "ERROR")

# WebSocket URL check
if [ "$PREVIEW_WS" = "ERROR" ] || [ "$PROD_WS" = "ERROR" ]; then
  fail "NEXT_PUBLIC_LH_PARTY_WS_URL: Could not fetch"
elif [ "$PREVIEW_WS" = "$PROD_WS" ]; then
  warn "NEXT_PUBLIC_LH_PARTY_WS_URL: Same in preview and prod"
  info "  Preview: $PREVIEW_WS"
  info "  Prod:    $PROD_WS"
else
  pass "NEXT_PUBLIC_LH_PARTY_WS_URL: Different (good!)"
  info "  Preview: $PREVIEW_WS"
  info "  Prod:    $PROD_WS"
fi

# Database URL check
if [ "$PREVIEW_DB" = "ERROR" ] || [ "$PROD_DB" = "ERROR" ]; then
  fail "LH_PARTY_DATABASE_URL: Could not fetch"
elif [ "$PREVIEW_DB" = "$PROD_DB" ]; then
  warn "LH_PARTY_DATABASE_URL: Same in preview and prod (should be different for isolation)"
  # Extract host for display (hide credentials)
  PREVIEW_HOST=$(echo "$PREVIEW_DB" | sed -E 's/.*@([^/]+)\/.*/\1/' || echo "unknown")
  PROD_HOST=$(echo "$PROD_DB" | sed -E 's/.*@([^/]+)\/.*/\1/' || echo "unknown")
  info "  Both point to: $PREVIEW_HOST"
else
  pass "LH_PARTY_DATABASE_URL: Different (good!)"
  PREVIEW_HOST=$(echo "$PREVIEW_DB" | sed -E 's/.*@([^/]+)\/.*/\1/' || echo "unknown")
  PROD_HOST=$(echo "$PROD_DB" | sed -E 's/.*@([^/]+)\/.*/\1/' || echo "unknown")
  info "  Preview: $PREVIEW_HOST"
  info "  Prod:    $PROD_HOST"
fi

# ============================================================================
# GITHUB CONFIGURATION
# ============================================================================
print_header "GitHub Configuration"

print_section "GitHub Secrets"

GH_SECRETS=$(gh secret list 2>/dev/null || echo "ERROR")
if [ "$GH_SECRETS" = "ERROR" ]; then
  fail "Could not fetch GitHub secrets (not logged in or no repo access?)"
else
  for secret in NEON_API_KEY VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
    if echo "$GH_SECRETS" | grep -q "$secret"; then
      pass "Secret '$secret' exists"
    else
      fail "Secret '$secret' missing"
    fi
  done
fi

print_section "GitHub Variables"

GH_VARS=$(gh variable list 2>/dev/null || echo "ERROR")
if [ "$GH_VARS" = "ERROR" ]; then
  fail "Could not fetch GitHub variables"
else
  for var in NEON_PROJECT_ID PREVIEW_WS_URL; do
    if echo "$GH_VARS" | grep -q "$var"; then
      pass "Variable '$var' exists"
      VALUE=$(echo "$GH_VARS" | grep "$var" | awk '{print $2}')
      info "  Value: $VALUE"
    else
      fail "Variable '$var' missing"
    fi
  done
fi

# ============================================================================
# VERCEL CONFIGURATION
# ============================================================================
print_header "Vercel Configuration"

print_section "Vercel Project"

VERCEL_PROJECT=$(cat .vercel/project.json 2>/dev/null || echo "{}")
if [ "$VERCEL_PROJECT" != "{}" ]; then
  PROJECT_ID=$(echo "$VERCEL_PROJECT" | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4)
  ORG_ID=$(echo "$VERCEL_PROJECT" | grep -o '"orgId":"[^"]*"' | cut -d'"' -f4)
  pass "Vercel project linked"
  info "  Project ID: $PROJECT_ID"
  info "  Org ID: $ORG_ID"
else
  fail "Vercel project not linked (run 'vercel link')"
fi

print_section "Vercel Environment Variables"

for env in production preview development; do
  echo ""
  echo "  Environment: $env"
  VERCEL_VARS=$(timeout 5 vercel env ls --environment $env 2>/dev/null | grep -E "(WS_URL|DATABASE_URL)" | head -5 || echo "")
  if [ -n "$VERCEL_VARS" ]; then
    echo "$VERCEL_VARS" | while read -r line; do
      info "  $line"
    done
  else
    warn "  No matching env vars found (or not accessible)"
  fi
done

# ============================================================================
# NEON CONFIGURATION
# ============================================================================
print_header "Neon Configuration"

if check_command neonctl; then
  print_section "Neon Branches"

  NEON_PROJECT_ID=$(doppler secrets get LH_PARTY_NEON_PROJECT_ID --config dev --plain 2>/dev/null || echo "")

  if [ -n "$NEON_PROJECT_ID" ]; then
    info "Project ID: $NEON_PROJECT_ID"

    BRANCHES=$(timeout 10 neonctl branches list --project-id "$NEON_PROJECT_ID" 2>/dev/null || echo "ERROR")
    if [ "$BRANCHES" != "ERROR" ]; then
      echo ""
      echo "$BRANCHES" | head -20
      echo ""

      if echo "$BRANCHES" | grep -q "production"; then
        pass "Production branch exists"
      else
        warn "No 'production' branch found (recommended for prod isolation)"
      fi

      if echo "$BRANCHES" | grep -q "main"; then
        pass "Main branch exists"
      fi
    else
      fail "Could not list Neon branches (auth issue?)"
    fi
  else
    warn "NEON_PROJECT_ID not found in Doppler"
  fi
else
  warn "Skipping Neon checks (neonctl not installed)"
fi

# ============================================================================
# RAILWAY CONFIGURATION
# ============================================================================
print_header "Railway Configuration"

print_section "Railway Project Status"

RAILWAY_STATUS=$(timeout 5 railway status 2>/dev/null || echo "ERROR")
if [ "$RAILWAY_STATUS" = "ERROR" ]; then
  fail "Railway not linked (run 'railway link')"
else
  echo "$RAILWAY_STATUS"

  if echo "$RAILWAY_STATUS" | grep -q "Service: None"; then
    warn "No service linked - run 'railway service <name>'"
  fi
fi

print_section "Railway Configuration File"

if [ -f "railway.toml" ]; then
  pass "railway.toml exists at repo root"
  info "Contents:"
  cat railway.toml | sed 's/^/    /'
elif [ -f "websocket-server/railway.toml" ]; then
  warn "railway.toml in websocket-server/ (should be at root for lib/ access)"
else
  fail "No railway.toml found"
fi

# ============================================================================
# LOCAL FILES CHECK
# ============================================================================
print_header "Local Configuration Files"

print_section "Required Files"

FILES_TO_CHECK=(
  ".github/workflows/preview-environment.yml:Preview environment workflow"
  "vercel.json:Vercel configuration"
  "railway.toml:Railway configuration"
  "websocket-server/build.mjs:WebSocket server build script"
  "websocket-server/package.json:WebSocket server package"
)

for item in "${FILES_TO_CHECK[@]}"; do
  FILE="${item%%:*}"
  DESC="${item##*:}"
  if [ -f "$FILE" ]; then
    pass "$DESC ($FILE)"
  else
    fail "$DESC ($FILE) - missing"
  fi
done

print_section "vercel.json Preview Deploy Setting"

if [ -f "vercel.json" ]; then
  if grep -q '"deploymentEnabled"' vercel.json; then
    pass "Preview auto-deploy configuration found"
    DEPLOY_CONFIG=$(grep -A5 '"deploymentEnabled"' vercel.json | head -6)
    info "Config: $DEPLOY_CONFIG"
  else
    warn "No deploymentEnabled config (Vercel will auto-deploy all branches)"
  fi
fi

# ============================================================================
# SUMMARY
# ============================================================================
print_header "Summary"

echo ""
echo -e "  ${GREEN}Passed:${NC}  $PASS"
echo -e "  ${RED}Failed:${NC}  $FAIL"
echo -e "  ${YELLOW}Warnings:${NC} $WARN"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Some checks failed. Please review the issues above.${NC}"
  exit 1
elif [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}All critical checks passed, but there are warnings to review.${NC}"
  exit 0
else
  echo -e "${GREEN}All checks passed! Your environment is properly configured.${NC}"
  exit 0
fi
