-- user_panel_state: cross-device persistence for the floating panel system.
-- One row per user; `state` holds { panels: [...], tray: [...] } as written by
-- the client (debounced PATCH /api/panel-state). Realtime delivers updates to
-- the user's other devices.
--
-- Structure only — no row data is read or modified.

CREATE TABLE IF NOT EXISTS user_panel_state (
  user_profile_id UUID PRIMARY KEY REFERENCES user_profile(id) ON DELETE CASCADE,
  state           JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_panel_state ENABLE ROW LEVEL SECURITY;

-- Owner-only policies, matching the established style (20260315000001).
DROP POLICY IF EXISTS "Users can view own panel state" ON user_panel_state;
CREATE POLICY "Users can view own panel state"
  ON user_panel_state FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own panel state" ON user_panel_state;
CREATE POLICY "Users can insert own panel state"
  ON user_panel_state FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own panel state" ON user_panel_state;
CREATE POLICY "Users can update own panel state"
  ON user_panel_state FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

-- Realtime: REPLICA IDENTITY FULL so RLS can be evaluated on UPDATE events
-- (mirrors 20260316000003), then add to the publication (idempotent).
ALTER TABLE user_panel_state REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_panel_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_panel_state;
  END IF;
END;
$$;
