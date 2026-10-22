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
# Newer hammerhead (pinned so the patch below always matches), then fix captcha support.
npm install --no-audit --no-fund testcafe-hammerhead@31.7.8
node ../scripts/patch-hammerhead.js
npm run build
echo "Setup complete."
