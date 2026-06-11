-- ============================================================
-- box_scan.duplicate_count
--
-- The sticker scan used to silently skip a label entry when it fuzzy-matched
-- an item already packed in ANOTHER box. A handwritten "Blender" when a
-- Blender sits in WH03 often means a second physical blender — so the scanner
-- now records those as kind:'duplicate' entries in proposed_items (jsonb, no
-- shape change needed) for the owner to resolve in the review UI.
--
-- Counts on box_scan are real columns (total_found, matched_count, …), so the
-- duplicate tally gets one too. Structure-only; no row data touched.
-- ============================================================

ALTER TABLE box_scan ADD COLUMN IF NOT EXISTS duplicate_count INTEGER NOT NULL DEFAULT 0;
