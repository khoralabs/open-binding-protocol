#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for pkg in model persistence nbc frame session transport; do
  echo "==> obp: $pkg"
  (cd "$ROOT/$pkg" && smithy validate model && smithy build)
done
echo "==> obp: all packages OK"
