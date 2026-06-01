-- Cached Telemt sidecar binary version from worker status (e.g. "3.4.13").

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS telemt_version TEXT NOT NULL DEFAULT '';
