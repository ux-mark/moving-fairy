-- ============================================================
-- Box labels: luggage loses its warehouse code, single items gain one
--
-- Re-aligns stored box labels with computeBoxLabel() in src/lib/constants.ts:
--
--   single_item     → WH<NN>            (an item shipped on its own IS a freight
--                                         package, so it gets a warehouse code)
--   checked_luggage → <room_name>       (hand luggage travels with you — it is
--   carryon         → <room_name>        not freight, so it carries no code)
--
-- standard boxes are untouched (WH<NN>-<roomcode>) so the user's already-
-- stickered freight labels don't change.
--
-- room_code is cleared for all three types (none of them carry a code suffix).
-- These are label/room_code UPDATEs only — no rows or columns are removed.
-- ============================================================

-- Single items → bare warehouse package code (WH<NN>).
UPDATE box
SET label = 'WH' || lpad(box_number::text, 2, '0'),
    room_code = NULL,
    updated_at = NOW()
WHERE box_type = 'single_item';

-- Checked luggage / carry-on → descriptive name, no warehouse code.
UPDATE box
SET label = room_name,
    room_code = NULL,
    updated_at = NOW()
WHERE box_type IN ('checked_luggage', 'carryon');
