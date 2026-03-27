-- Fix RLS policies for item_conversation and item_conversation_message.
-- The original policies incorrectly compared user_profile_id directly to auth.uid(),
-- but user_profile.id != auth.uid(). Must join through user_profile.auth_user_id.

-- Drop and recreate item_conversation policies
DROP POLICY IF EXISTS "Users can view own conversations" ON item_conversation;
CREATE POLICY "Users can view own conversations" ON item_conversation
  FOR SELECT USING (
    item_assessment_id IN (
      SELECT ia.id FROM item_assessment ia
      JOIN user_profile up ON ia.user_profile_id = up.id
      WHERE up.auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own conversations" ON item_conversation;
CREATE POLICY "Users can insert own conversations" ON item_conversation
  FOR INSERT WITH CHECK (
    item_assessment_id IN (
      SELECT ia.id FROM item_assessment ia
      JOIN user_profile up ON ia.user_profile_id = up.id
      WHERE up.auth_user_id = auth.uid()::text
    )
  );

-- Drop and recreate item_conversation_message policies
DROP POLICY IF EXISTS "Users can view own messages" ON item_conversation_message;
CREATE POLICY "Users can view own messages" ON item_conversation_message
  FOR SELECT USING (
    item_conversation_id IN (
      SELECT ic.id FROM item_conversation ic
      JOIN item_assessment ia ON ic.item_assessment_id = ia.id
      JOIN user_profile up ON ia.user_profile_id = up.id
      WHERE up.auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can insert own messages" ON item_conversation_message;
CREATE POLICY "Users can insert own messages" ON item_conversation_message
  FOR INSERT WITH CHECK (
    item_conversation_id IN (
      SELECT ic.id FROM item_conversation ic
      JOIN item_assessment ia ON ic.item_assessment_id = ia.id
      JOIN user_profile up ON ia.user_profile_id = up.id
      WHERE up.auth_user_id = auth.uid()::text
    )
  );
