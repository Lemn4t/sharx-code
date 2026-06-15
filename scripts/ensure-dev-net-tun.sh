#!/bin/sh
# WireGuard / AmneziaWG userspace needs /dev/net/tun (common gap in minimal containers).
if [ -e /dev/net/tun ]; then
  return 0 2>/dev/null || exit 0
fi
mkdir -p /dev/net 2>/dev/null || true
if mknod /dev/net/tun c 10 200 2>/dev/null; then
  chmod 666 /dev/net/tun 2>/dev/null || true
  echo "ensure-dev-net-tun: created /dev/net/tun" >&2
else
  echo "ensure-dev-net-tun: /dev/net/tun missing (mount host device or cap NET_ADMIN)" >&2
fi
