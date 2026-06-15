#!/bin/sh

# Start fail2ban
[ $XUI_ENABLE_FAIL2BAN == "true" ] && fail2ban-client -x start

# AmneziaWG / WireGuard sidecars on standalone panel
. /app/scripts/ensure-dev-net-tun.sh 2>/dev/null || true

# Run x-ui
exec /app/x-ui
