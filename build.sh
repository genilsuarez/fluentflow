#!/usr/bin/env bash
# FluentFlow — Build (Vite+React+TS) + monitor GitHub Actions deploy
set -euo pipefail

REPO="genilsuarez/fluentflow"
WORKFLOW="CD Deploy"
BRANCH="main"
TIMEOUT=600
INTERVAL=10

echo "📦 FluentFlow — running full build pipeline..."

# Full local build (lint, type-check, tests, vite build)
if ! npm run build:full; then
  echo "❌ FluentFlow — local build failed"
  exit 1
fi
echo "✅ Local build passed"

echo "🔍 Monitoring deploy workflow on GitHub Actions..."

# Get the latest run for the deploy workflow on main
RUN_ID=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --branch "$BRANCH" --limit 1 --json databaseId,status --jq '.[0].databaseId')

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "⚠️  No deploy runs found for $WORKFLOW"
  exit 1
fi

STATUS=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --branch "$BRANCH" --limit 1 --json status,conclusion --jq '.[0] | "\(.status)|\(.conclusion)"')
CURRENT_STATUS="${STATUS%%|*}"
CURRENT_CONCLUSION="${STATUS##*|}"

if [ "$CURRENT_STATUS" = "completed" ] && [ "$CURRENT_CONCLUSION" = "success" ]; then
  echo "✅ FluentFlow deploy — OK (run #$RUN_ID already succeeded)"
  exit 0
fi

if [ "$CURRENT_STATUS" = "completed" ] && [ "$CURRENT_CONCLUSION" != "success" ]; then
  echo "❌ FluentFlow deploy — FAILED (conclusion: $CURRENT_CONCLUSION)"
  echo "   → gh run view $RUN_ID --repo $REPO --web"
  exit 1
fi

# Still running — poll until complete
ELAPSED=0
echo "   Run #$RUN_ID is $CURRENT_STATUS, waiting..."

while [ $ELAPSED -lt $TIMEOUT ]; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))

  STATUS=$(gh run view "$RUN_ID" --repo "$REPO" --json status,conclusion --jq '"\(.status)|\(.conclusion)"')
  S="${STATUS%%|*}"
  C="${STATUS##*|}"

  if [ "$S" = "completed" ]; then
    if [ "$C" = "success" ]; then
      echo "✅ FluentFlow deploy — OK (${ELAPSED}s)"
      exit 0
    else
      echo "❌ FluentFlow deploy — FAILED (conclusion: $C, ${ELAPSED}s)"
      echo "   → gh run view $RUN_ID --repo $REPO --web"
      exit 1
    fi
  fi

  printf "   [%3ds] %s\n" "$ELAPSED" "$S"
done

echo "❌ FluentFlow deploy — TIMEOUT after ${TIMEOUT}s (still $S)"
exit 1
