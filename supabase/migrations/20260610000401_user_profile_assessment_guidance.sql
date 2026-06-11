-- assessment_guidance: owner-editable standing instructions for Aisling.
-- Injected into composeAislingCore so both background assessment and per-item
-- chat honour the owner's preferences (e.g. "Only recommend Carry for
-- documents, medicines and the laptop"). Plain text, capped at ~500 chars in
-- the API layer.
--
-- Structure only — no row data is read or modified.

ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS assessment_guidance TEXT;
