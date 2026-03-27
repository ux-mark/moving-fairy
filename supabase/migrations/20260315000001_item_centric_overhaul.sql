-- ============================================================
-- Item-centric overhaul migration
-- This is a wipe migration — zero production users at this point.
-- ============================================================

-- Drop old tables that are no longer needed
DROP TABLE IF EXISTS message CASCADE;
DROP TABLE IF EXISTS session CASCADE;

-- Rename DECIDE_LATER to REVISIT in the verdict enum
ALTER TYPE verdict RENAME VALUE 'DECIDE_LATER' TO 'REVISIT';

-- Add new columns to item_assessment
ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'completed'
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE item_assessment ALTER COLUMN verdict DROP NOT NULL;
-- verdict is null while pending/processing

-- Drop the session_id FK (session table is gone)
ALTER TABLE item_assessment DROP CONSTRAINT IF EXISTS item_assessment_session_id_fkey;
ALTER TABLE item_assessment DROP COLUMN IF EXISTS session_id;

ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS confidence INTEGER NULL;
ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS needs_clarification BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'chat'
  CHECK (source IN ('photo_upload', 'text_add', 'sticker_scan', 'manual'));

-- RLS Policies for item_assessment (required for Supabase Realtime)
-- These use auth.uid() to match the user_profile.auth_user_id
-- Drop first to avoid conflicts with policies created in earlier migrations
DROP POLICY IF EXISTS "Users can view own assessments" ON item_assessment;
CREATE POLICY "Users can view own assessments"
  ON item_assessment FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own assessments" ON item_assessment;
CREATE POLICY "Users can insert own assessments"
  ON item_assessment FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can update own assessments" ON item_assessment;
CREATE POLICY "Users can update own assessments"
  ON item_assessment FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own assessments" ON item_assessment;
CREATE POLICY "Users can delete own assessments"
  ON item_assessment FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

-- Also add RLS policies for user_profile
DROP POLICY IF EXISTS "Users can view own profile" ON user_profile;
CREATE POLICY "Users can view own profile"
  ON user_profile FOR SELECT
  USING (auth_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profile;
CREATE POLICY "Users can update own profile"
  ON user_profile FOR UPDATE
  USING (auth_user_id = auth.uid()::text);

-- RLS policies for box
DROP POLICY IF EXISTS "Users can view own boxes" ON box;
CREATE POLICY "Users can view own boxes"
  ON box FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own boxes" ON box;
CREATE POLICY "Users can insert own boxes"
  ON box FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can update own boxes" ON box;
CREATE POLICY "Users can update own boxes"
  ON box FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own boxes" ON box;
CREATE POLICY "Users can delete own boxes"
  ON box FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()::text
    )
  );

-- RLS policies for box_item
DROP POLICY IF EXISTS "Users can view own box items" ON box_item;
CREATE POLICY "Users can view own box items"
  ON box_item FOR SELECT
  USING (
    box_id IN (
      SELECT b.id FROM box b
      JOIN user_profile up ON b.user_profile_id = up.id
      WHERE up.auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own box items" ON box_item;
CREATE POLICY "Users can insert own box items"
  ON box_item FOR INSERT
  WITH CHECK (
    box_id IN (
      SELECT b.id FROM box b
      JOIN user_profile up ON b.user_profile_id = up.id
      WHERE up.auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own box items" ON box_item;
CREATE POLICY "Users can delete own box items"
  ON box_item FOR DELETE
  USING (
    box_id IN (
      SELECT b.id FROM box b
      JOIN user_profile up ON b.user_profile_id = up.id
      WHERE up.auth_user_id = auth.uid()::text
    )
  );

-- Enable Realtime for item_assessment
ALTER PUBLICATION supabase_realtime ADD TABLE item_assessment;
