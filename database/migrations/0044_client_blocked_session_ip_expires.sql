-- Optional expiry for session IP blocks (auto IP-limit bans).

ALTER TABLE client_blocked_session_ips ADD COLUMN IF NOT EXISTS expires_at BIGINT NOT NULL DEFAULT 0;
