#!/usr/bin/env bash
pkill -f "node src/server.js" && echo "Proxy stopped." || echo "Proxy was not running."
