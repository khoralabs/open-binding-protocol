#!/usr/bin/env bash
# Deprecated: use docs/spec/validate.sh
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docs/spec/validate.sh"
