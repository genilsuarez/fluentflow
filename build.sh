#!/usr/bin/env bash
# FluentFlow — Full pipeline: local quality gates + optional CI/CD monitoring
# Exit codes: 0 = all good, 1 = local pipeline failed, 0 = CI warnings (non-blocking)
set -euo pipefail

REPO="genilsuarez/fluentflow"
BRANCH="main"
TIMEOUT=120
INTERVAL=10
WARNINGS=()

echo "📦 FluentFlow — running full pipeline..."
echo ""

# ─── Phase 1: Local pipeline (blocking) ─────────────────────────────────────────

if ! node scripts/development/dev-tools.js full --quiet; then
  echo ""
  echo "❌ FluentFlow — local pipeline failed"
  echo "   Fix errors above, then re-run."
  exit 1
fi

echo ""
echo "✅ Local pipeline passed"

# ─── Phase 2: Monitor CI/CD (non-blocking) ──────────────────────────────────────

COMMIT_SHA=$(git rev-parse HEAD)

wait_workflow() {
  local WORKFLOW_NAME="$1"
  local ELAPSED=0
  local FOUND=false

  echo "🔍 $WORKFLOW_NAME..."

  # Give GitHub a moment to register the run
  sleep 3

  while [ $ELAPSED -lt $TIMEOUT ]; do
    RUN=$(gh run list --repo "$REPO" --workflow "$WORKFLOW_NAME" --branch "$BRANCH" --limit 5 --json databaseId,status,conclusion,headSha \
      --jq "[.[] | select(.headSha == \"$COMMIT_SHA\")] | .[0]" 2>/dev/null || echo "")

    if [ -n "$RUN" ] && [ "$RUN" != "null" ]; then
      FOUND=true
      STATUS=$(echo "$RUN" | jq -r '.status')
      CONCLUSION=$(echo "$RUN" | jq -r '.conclusion')
      RUN_ID=$(echo "$RUN" | jq -r '.databaseId')

      if [ "$STATUS" = "completed" ]; then
        if [ "$CONCLUSION" = "success" ]; then
          echo "   ✅ passed"
          return 0
        else
          echo "   ⚠️  failed (conclusion: $CONCLUSION)"
          echo "      gh run view $RUN_ID --repo $REPO --web"
          return 1
        fi
      fi
    fi

    # If no run found after 30s, likely no workflow triggered
    if [ "$FOUND" = false ] && [ $ELAPSED -ge 30 ]; then
      echo "   ⚠️  not triggered (no run found for $COMMIT_SHA)"
      return 1
    fi

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
    printf "   [%3ds] waiting...\r" "$ELAPSED"
  done

  # Clear the last \r line
  printf "   %-30s\n" ""
  echo "   ⚠️  timeout after ${TIMEOUT}s"
  return 1
}

echo ""
echo "── CI/CD Monitoring ──────────────────────────"
echo ""

for WF in "CI Build" "CI Quality" "CI Security" "CD Deploy"; do
  if ! wait_workflow "$WF"; then
    WARNINGS+=("$WF")
  fi
done

# ─── Report ─────────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────────────"

if [ ${#WARNINGS[@]} -eq 0 ]; then
  echo "✅ FluentFlow — fully deployed"
else
  echo "✅ FluentFlow — pushed (${#WARNINGS[@]} CI warning(s))"
  for w in "${WARNINGS[@]}"; do
    echo "   ⚠️  $w"
  done
  echo ""
  echo "   Local build passed. CI issues are non-blocking."
fi
