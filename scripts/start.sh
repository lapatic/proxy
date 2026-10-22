#!/usr/bin/env bash
# Starts the proxy in the background (logs: proxy.log). Safe to run twice.
cd "$(dirname "$0")/.."
[ -d rammerhead/node_modules ] || bash scripts/setup.sh
cp config.js rammerhead/config.js

if curl -fs -o /dev/null http://127.0.0.1:8080/ 2>/dev/null; then
  echo "Proxy already running on port 8080."
else
  (cd rammerhead && nohup node src/server.js >> ../proxy.log 2>&1 &)
  for _ in $(seq 1 30); do
    curl -fs -o /dev/null http://127.0.0.1:8080/ 2>/dev/null && break
    sleep 1
  done
fi

if [ -n "${PROXY_PASSWORD:-}" ]; then
  echo "Password: (your PROXY_PASSWORD)"
elif [ -f rammerhead/.proxy-password ]; then
  echo "Password: $(cat rammerhead/.proxy-password)"
fi

if [ -n "${CODESPACE_NAME:-}" ]; then
  echo "Open: https://${CODESPACE_NAME}-8080.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}/"
else
  echo "Open: http://localhost:8080/"
fi
