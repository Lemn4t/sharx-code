-- Worker AmneziaWG sidecar state (mirrors telemt_state).
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS amneziawg_state TEXT NOT NULL DEFAULT 'unknown';
