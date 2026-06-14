-- Host-level subscription security override: empty = inherit from inbound, "tls" = force TLS in share links, "none" = force no TLS.
-- Use case: Caddy/HAProxy fronts Xray on :443 — Xray runs with security=none, but share links must advertise security=tls.
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS subscription_security VARCHAR(16) NOT NULL DEFAULT '';
