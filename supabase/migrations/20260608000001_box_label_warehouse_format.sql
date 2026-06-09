-- ============================================================
-- box_label_warehouse_format
--
-- 1. Add box.is_biosecurity — a MANUAL OVERRIDE only. A box is treated as
--    biosecurity-relevant when it is true OR it currently contains any
--    biosecurity-flagged item (the latter is derived live in the app, not
--    stored), so we intentionally do NOT backfill this from item flags:
--    removing every flagged item should drop the automatic badge.
--
-- 2. Renumber + relabel every box into the new warehouse format. box_number is
--    now a single per-user sequence (never reused); the label is
--    `<PREFIX><NN>-<suffix>`:
--      standard         → WH01-K   (suffix = room-code letter)
--      checked_luggage  → WH02-L
--      carryon          → WH03-C
--      single_item      → label left as its descriptive item name (it still
--                         gets a sequence number for uniqueness)
--    PREFIX is 'WH' here — keep in sync with BOX_LABEL_PREFIX in
--    src/lib/constants.ts. Room-code mapping mirrors roomCode() there.
--
-- 3. Enforce the per-user uniqueness of box_number.
-- ============================================================

-- 1. Manual biosecurity override flag (derived status is computed in-app).
ALTER TABLE box
  ADD COLUMN IF NOT EXISTS is_biosecurity BOOLEAN NOT NULL DEFAULT false;

-- 2a. Room-code helper — mirror of TS roomCode(). Dropped at the end.
CREATE OR REPLACE FUNCTION mf_room_code(room_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT := lower(btrim(coalesce(room_name, '')));
  mapped TEXT;
  first_letter TEXT;
BEGIN
  mapped := CASE normalized
    WHEN 'kitchen'     THEN 'K'
    WHEN 'bedroom'     THEN 'B'
    WHEN 'bathroom'    THEN 'A'
    WHEN 'living room' THEN 'L'
    WHEN 'lounge'      THEN 'L'
    WHEN 'garage'      THEN 'G'
    WHEN 'office'      THEN 'O'
    WHEN 'dining'      THEN 'D'
    WHEN 'kids'        THEN 'C'
    WHEN 'children'    THEN 'C'
    WHEN 'hall'        THEN 'H'
    WHEN 'hallway'     THEN 'H'
    WHEN 'garden'      THEN 'Y'
    WHEN 'outdoor'     THEN 'Y'
    WHEN 'store'       THEN 'S'
    WHEN 'storage'     THEN 'S'
    WHEN 'master'      THEN 'M'
    ELSE NULL
  END;

  IF mapped IS NOT NULL THEN
    RETURN mapped;
  END IF;

  first_letter := (regexp_match(upper(coalesce(room_name, '')), '[A-Z]'))[1];
  RETURN coalesce(first_letter, 'X');
END;
$$;

-- 2b. Assign a per-user global sequence by created_at and derive the label in a
-- single UPDATE. PostgreSQL checks unique constraints at end-of-statement, so a
-- whole-table renumber/permutation in one statement never trips uq_box_label or
-- uq_box_room_number mid-flight.
WITH seq AS (
  SELECT
    id,
    label AS old_label,
    row_number() OVER (
      PARTITION BY user_profile_id ORDER BY created_at, id
    ) AS rn
  FROM box
)
UPDATE box b
SET
  box_number = s.rn,
  label = CASE b.box_type
    -- 'WH' = BOX_LABEL_PREFIX (keep in sync with src/lib/constants.ts).
    WHEN 'standard'        THEN 'WH' || lpad(s.rn::text, 2, '0') || '-' || mf_room_code(b.room_name)
    WHEN 'checked_luggage' THEN 'WH' || lpad(s.rn::text, 2, '0') || '-L'
    WHEN 'carryon'         THEN 'WH' || lpad(s.rn::text, 2, '0') || '-C'
    ELSE s.old_label  -- single_item keeps its descriptive label
  END,
  updated_at = NOW()
FROM seq s
WHERE b.id = s.id;

DROP FUNCTION IF EXISTS mf_room_code(TEXT);

-- 3. Per-user box numbers are unique and never reused.
ALTER TABLE box
  DROP CONSTRAINT IF EXISTS uq_box_number;
ALTER TABLE box
  ADD CONSTRAINT uq_box_number UNIQUE (user_profile_id, box_number);
