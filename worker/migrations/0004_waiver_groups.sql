-- One submission can now cover a parent plus several children. Every person
-- still gets their own row; rows signed together share a group_id.
ALTER TABLE waivers ADD COLUMN group_id TEXT;
ALTER TABLE waivers ADD COLUMN guardian_included INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_waivers_group ON waivers (group_id);
