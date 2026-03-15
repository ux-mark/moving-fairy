-- Per-item conversation tables (Phase 2)

CREATE TABLE item_conversation (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_assessment_id UUID NOT NULL REFERENCES item_assessment(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_item_conversation UNIQUE (item_assessment_id)
);

CREATE TABLE item_conversation_message (
  id                    TEXT NOT NULL,
  item_conversation_id  UUID NOT NULL REFERENCES item_conversation(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content               TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_conversation_id, id)
);

-- Enable RLS
ALTER TABLE item_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_conversation_message ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses, but good practice)
CREATE POLICY "Users can view own conversations" ON item_conversation
  FOR SELECT USING (
    item_assessment_id IN (
      SELECT id FROM item_assessment WHERE user_profile_id = auth.uid()::text::uuid
    )
  );

CREATE POLICY "Users can insert own conversations" ON item_conversation
  FOR INSERT WITH CHECK (
    item_assessment_id IN (
      SELECT id FROM item_assessment WHERE user_profile_id = auth.uid()::text::uuid
    )
  );

CREATE POLICY "Users can view own messages" ON item_conversation_message
  FOR SELECT USING (
    item_conversation_id IN (
      SELECT ic.id FROM item_conversation ic
      JOIN item_assessment ia ON ic.item_assessment_id = ia.id
      WHERE ia.user_profile_id = auth.uid()::text::uuid
    )
  );

CREATE POLICY "Users can insert own messages" ON item_conversation_message
  FOR INSERT WITH CHECK (
    item_conversation_id IN (
      SELECT ic.id FROM item_conversation ic
      JOIN item_assessment ia ON ic.item_assessment_id = ia.id
      WHERE ia.user_profile_id = auth.uid()::text::uuid
    )
  );

-- Indexes
CREATE INDEX idx_item_conversation_assessment ON item_conversation(item_assessment_id);
CREATE INDEX idx_item_conversation_message_conversation ON item_conversation_message(item_conversation_id, created_at);
