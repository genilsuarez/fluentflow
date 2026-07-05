#!/usr/bin/env bash
# FluentFlow — Full pipeline: quality + security + build + deploy monitoring
# Delegates entirely to npm run build:full which handles everything
set -euo pipefail

echo "📦 FluentFlow — running full pipeline..."

if ! npm run build:full; then
  echo "❌ FluentFlow — pipeline failed"
  exit 1
fi

echo "✅ FluentFlow — OK"
