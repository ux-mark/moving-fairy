-- Fix item_conversation RLS:
--   1) Drop redundant auth.uid()::text::uuid casts (auth.uid() already returns uuid).
--   2) Correct the semantics: item_assessment.user_profile_id references user_profile.id,
--      not auth.users.id. Previous policies compared it directly to auth.uid() (the
--      auth.users.id), so they would never match. Service-role queries bypass RLS so
--      this never broke the app, but the policies were effectively always-deny.
--      Now we resolve through user_profile.auth_user_id — matching the pattern used
--      by 315001 and 316002.

DROP POLICY IF EXISTS "Users can view own conversations"   ON item_conversation;
DROP POLICY IF EXISTS "Users can insert own conversations" ON item_conversation;
DROP POLICY IF EXISTS "Users can view own messages"        ON item_conversation_message;
DROP POLICY IF EXISTS "Users can insert own messages"      ON item_conversation_message;

CREATE POLICY "Users can view own conversations" ON item_conversation
  FOR SELECT USING (
    item_assessment_id IN (
      SELECT id FROM item_assessment WHERE user_profile_id IN (
        SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own conversations" ON item_conversation
  FOR INSERT WITH CHECK (
    item_assessment_id IN (
      SELECT id FROM item_assessment WHERE user_profile_id IN (
        SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can view own messages" ON item_conversation_message
  FOR SELECT USING (
    item_conversation_id IN (
      SELECT ic.id FROM item_conversation ic
      JOIN item_assessment ia ON ic.item_assessment_id = ia.id
      WHERE ia.user_profile_id IN (
        SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own messages" ON item_conversation_message
  FOR INSERT WITH CHECK (
    item_conversation_id IN (
      SELECT ic.id FROM item_conversation ic
      JOIN item_assessment ia ON ic.item_assessment_id = ia.id
      WHERE ia.user_profile_id IN (
        SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
      )
    )
  );
