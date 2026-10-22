#!/usr/bin/env bash
# Installs Rammerhead (the proxy engine) next to this repo's config. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
RH_REF="${RH_REF:-master}"

if [ ! -d rammerhead/.git ]; then
  git clone --depth 1 --branch "$RH_REF" https://github.com/binary-person/rammerhead.git rammerhead
fi
cp config.js rammerhead/config.js
cd rammerhead
npm install --no-audit --no-fund
npm run build
echo "Setup complete."
