-- Create the message table
CREATE TABLE message (
  id          TEXT NOT NULL,
  session_id  UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

CREATE INDEX idx_message_session_id ON message(session_id);
CREATE INDEX idx_message_session_created ON message(session_id, created_at);

-- Enable RLS (consistent with all other tables)
ALTER TABLE message ENABLE ROW LEVEL SECURITY;

-- Migrate existing data from session.messages JSONB into the new table
INSERT INTO message (id, session_id, role, content, created_at)
SELECT
  elem->>'id',
  s.id,
  elem->>'role',
  elem->>'content',
  (elem->>'created_at')::timestamptz
FROM session s,
     jsonb_array_elements(s.messages) AS elem
WHERE jsonb_typeof(s.messages) = 'array'
  AND jsonb_array_length(s.messages) > 0
ON CONFLICT (session_id, id) DO NOTHING;

-- Drop the messages column from session
ALTER TABLE session DROP COLUMN messages;
