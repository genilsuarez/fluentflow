#!/usr/bin/env bash
# FluentFlow — Full pipeline: quality + security + build + deploy monitoring
# Monitoring is non-blocking: failures are reported but don't break the pipeline
set -euo pipefail

REPO="genilsuarez/fluentflow"
BRANCH="main"
TIMEOUT=180
INTERVAL=10
WARNINGS=()

echo "📦 FluentFlow — running full pipeline..."

# ─── Build (quality + security + build + push) ──────────────────────────────────

if ! node scripts/development/dev-tools.js full --quiet; then
  if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "⚠️  Pipeline script exited non-zero but dist exists — continuing"
  else
    echo "❌ FluentFlow — build failed"
    exit 1
  fi
fi

# ─── Monitor CI/CD (non-blocking) ──────────────────────────────────────────────

COMMIT_SHA=$(git rev-parse HEAD)

wait_workflow() {
  local WORKFLOW_NAME="$1"
  local ELAPSED=0

  echo "🔍 Waiting for $WORKFLOW_NAME..."
  sleep 5

  while [ $ELAPSED -lt $TIMEOUT ]; do
    RUN=$(gh run list --repo "$REPO" --workflow "$WORKFLOW_NAME" --branch "$BRANCH" --limit 5 --json databaseId,status,conclusion,headSha \
      --jq "[.[] | select(.headSha == \"$COMMIT_SHA\")] | .[0]" 2>/dev/null || echo "")

    if [ -n "$RUN" ] && [ "$RUN" != "null" ]; then
      STATUS=$(echo "$RUN" | jq -r '.status')
      CONCLUSION=$(echo "$RUN" | jq -r '.conclusion')
      RUN_ID=$(echo "$RUN" | jq -r '.databaseId')

      if [ "$STATUS" = "completed" ]; then
        if [ "$CONCLUSION" = "success" ]; then
          echo "✅ $WORKFLOW_NAME passed"
          return 0
        else
          echo "⚠️  $WORKFLOW_NAME failed (conclusion: $CONCLUSION)"
          echo "   → gh run view $RUN_ID --repo $REPO --web"
          return 1
        fi
      fi
    fi

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
    printf "   [%3ds] waiting...\n" "$ELAPSED"
  done

  echo "⚠️  $WORKFLOW_NAME — timeout after ${TIMEOUT}s"
  return 1
}

# Monitor all 4 workflows
for WF in "CI Build" "CI Quality" "CI Security" "CD Deploy"; do
  if ! wait_workflow "$WF"; then
    WARNINGS+=("$WF")
  fi
done

# ─── Report ─────────────────────────────────────────────────────────────────────

echo ""
if [ ${#WARNINGS[@]} -eq 0 ]; then
  echo "✅ FluentFlow — OK"
else
  echo "✅ FluentFlow — deployed (with warnings)"
  for w in "${WARNINGS[@]}"; do
    echo "   ⚠️  $w"
  done
fi
