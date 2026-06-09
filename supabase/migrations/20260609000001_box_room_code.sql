-- ============================================================
-- box_room_code
--
-- Store a per-ROOM box code (the suffix after WH<nn>-) so the code reliably
-- identifies the room. Previously the code was derived live from the room name
-- via roomCode(), so two rooms sharing a first letter (e.g. "Bedroom" and
-- "Books", both → B) became indistinguishable.
--
-- The code is per (user_profile_id, room_name): every box in a room shares one
-- code, and codes are DISTINCT across a user's rooms. The first-created room
-- (by earliest box created_at) keeps its natural single-letter code; a later
-- room whose natural code collides is auto-extended to a distinct multi-letter
-- code (e.g. Bedroom=B kept, Books→Bk).
--
-- Resolution order (mirrors uniqueRoomCode() in src/lib/constants.ts):
--   1. base single-letter code (mf_room_code)
--   2. else base + the next CONSONANT of the name, lowercased (Books → Bk)
--   3. else base + the next letter of the name, lowercased
--   4. else base + a digit (2..9)
-- ...stopping at the first candidate not already used by an earlier room for
-- this user.
--
-- standard          → WH<nn>-<room_code>
-- checked_luggage   → WH<nn>-L  (room_code stored as 'L', fixed)
-- carryon           → WH<nn>-C  (room_code stored as 'C', fixed)
-- single_item       → label left as its descriptive item name (room_code NULL)
--
-- PREFIX is 'WH' — keep in sync with BOX_LABEL_PREFIX in src/lib/constants.ts.
-- ============================================================

ALTER TABLE box ADD COLUMN IF NOT EXISTS room_code TEXT NULL;

-- Base single-letter room code — mirror of TS roomCode(). Dropped at the end.
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

-- Resolve a unique room code given the base and the codes already taken by
-- earlier rooms for the same user. Mirrors uniqueRoomCode() in constants.ts.
-- Dropped at the end.
CREATE OR REPLACE FUNCTION mf_unique_room_code(room_name TEXT, used TEXT[])
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base TEXT := mf_room_code(room_name);
  letters TEXT := regexp_replace(lower(coalesce(room_name, '')), '[^a-z]', '', 'g');
  base_lower TEXT := lower(base);
  ch TEXT;
  candidate TEXT;
  i INT;
BEGIN
  IF NOT (base = ANY(used)) THEN
    RETURN base;
  END IF;

  -- 2. base + next consonant of the name (skip the letter the base came from
  --    if it's the leading one), lowercased.
  FOR i IN 1 .. length(letters) LOOP
    ch := substr(letters, i, 1);
    IF i = 1 AND ch = base_lower THEN
      CONTINUE;
    END IF;
    IF ch NOT IN ('a', 'e', 'i', 'o', 'u') THEN
      candidate := base || ch;
      IF NOT (candidate = ANY(used)) THEN
        RETURN candidate;
      END IF;
    END IF;
  END LOOP;

  -- 3. base + next letter of the name (any letter), lowercased.
  FOR i IN 1 .. length(letters) LOOP
    ch := substr(letters, i, 1);
    IF i = 1 AND ch = base_lower THEN
      CONTINUE;
    END IF;
    candidate := base || ch;
    IF NOT (candidate = ANY(used)) THEN
      RETURN candidate;
    END IF;
  END LOOP;

  -- 4. base + a digit.
  FOR i IN 2 .. 9 LOOP
    candidate := base || i::text;
    IF NOT (candidate = ANY(used)) THEN
      RETURN candidate;
    END IF;
  END LOOP;

  -- Last resort: append the base repeatedly until unique (degenerate names).
  candidate := base;
  LOOP
    candidate := candidate || base_lower;
    IF NOT (candidate = ANY(used)) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- Backfill: for each user, order rooms by the room's earliest box created_at and
-- assign collision-resolved codes. luggage/carryon get fixed L/C; standard get
-- the resolved per-room code; single_item is left untouched (room_code NULL).
DO $$
DECLARE
  u RECORD;
  r RECORD;
  used TEXT[];
  code TEXT;
BEGIN
  FOR u IN SELECT DISTINCT user_profile_id FROM box LOOP
    used := ARRAY[]::TEXT[];

    -- Room families (the first word of the room name) drive the collision set,
    -- so name variants like "Bedroom 1"/"Bedroom 2" share one code. Ordered by
    -- the family's earliest box created_at then the family for determinism. A
    -- representative room_name (the family's earliest box) feeds the code
    -- resolver — its first letter and consonants match the family.
    FOR r IN
      SELECT lower(split_part(btrim(room_name), ' ', 1)) AS family,
             (array_agg(room_name ORDER BY created_at))[1] AS sample_name
      FROM box
      WHERE user_profile_id = u.user_profile_id
        AND box_type = 'standard'
      GROUP BY lower(split_part(btrim(room_name), ' ', 1))
      ORDER BY min(created_at), lower(split_part(btrim(room_name), ' ', 1))
    LOOP
      code := mf_unique_room_code(r.sample_name, used);
      used := array_append(used, code);

      UPDATE box
      SET room_code = code,
          updated_at = NOW()
      WHERE user_profile_id = u.user_profile_id
        AND box_type = 'standard'
        AND lower(split_part(btrim(room_name), ' ', 1)) = r.family;
    END LOOP;

    -- Fixed codes for luggage / carryon.
    UPDATE box
    SET room_code = 'L', updated_at = NOW()
    WHERE user_profile_id = u.user_profile_id AND box_type = 'checked_luggage';

    UPDATE box
    SET room_code = 'C', updated_at = NOW()
    WHERE user_profile_id = u.user_profile_id AND box_type = 'carryon';
  END LOOP;
END;
$$;

-- Regenerate labels from the stored room_code in a single statement per type, so
-- end-of-statement uniqueness checks never trip mid-update.
UPDATE box
SET label = 'WH' || lpad(box_number::text, 2, '0') || '-' || room_code,
    updated_at = NOW()
WHERE box_type IN ('standard', 'checked_luggage', 'carryon')
  AND room_code IS NOT NULL;

DROP FUNCTION IF EXISTS mf_unique_room_code(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS mf_room_code(TEXT);
