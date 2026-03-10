-- Link user profiles to Supabase Auth users
ALTER TABLE user_profile ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_auth_user ON user_profile(auth_user_id);

-- RLS policies — users can only access their own data
-- user_profile
CREATE POLICY "Users can view own profile" ON user_profile FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON user_profile FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON user_profile FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- session (via user_profile)
CREATE POLICY "Users can view own sessions" ON session FOR SELECT USING (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own sessions" ON session FOR INSERT WITH CHECK (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update own sessions" ON session FOR UPDATE USING (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));

-- item_assessment (via user_profile)
CREATE POLICY "Users can view own assessments" ON item_assessment FOR SELECT USING (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own assessments" ON item_assessment FOR INSERT WITH CHECK (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update own assessments" ON item_assessment FOR UPDATE USING (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));

-- box (via user_profile)
CREATE POLICY "Users can view own boxes" ON box FOR SELECT USING (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own boxes" ON box FOR INSERT WITH CHECK (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update own boxes" ON box FOR UPDATE USING (user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid()));

-- box_item (via box → user_profile)
CREATE POLICY "Users can view own box items" ON box_item FOR SELECT USING (box_id IN (SELECT id FROM box WHERE user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid())));
CREATE POLICY "Users can insert own box items" ON box_item FOR INSERT WITH CHECK (box_id IN (SELECT id FROM box WHERE user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid())));
CREATE POLICY "Users can delete own box items" ON box_item FOR DELETE USING (box_id IN (SELECT id FROM box WHERE user_profile_id IN (SELECT id FROM user_profile WHERE auth_user_id = auth.uid())));
