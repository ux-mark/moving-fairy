-- ============================================================
-- box_scan + draft box items
--
-- Two fixes that together make the "packing label" (box sticker) scan work and
-- give it a review step:
--
-- 1. box_scan table — the scan runner (createBoxScan/updateBoxScan/getBoxScan in
--    src/mcp/tools.ts) reads and writes this table, but no migration ever created
--    it. Every scan therefore threw on the first insert, the POST returned 500,
--    and the client (which ignores the response and never polls) spun forever.
--
-- 2. box_item.is_draft — items the scan proposes (existing matches it thinks
--    belong here + brand-new items it created from the label) are added to the
--    box as DRAFTS. Drafts are excluded from the official manifest (totals,
--    biosecurity counts, print/export/share) until the owner confirms them, and
--    can be removed/edited individually. proposed_items on box_scan records what
--    each draft is (matched vs new) so the review UI can render it and so that
--    removing a "new" draft also deletes the item it created.
-- ============================================================

-- ─── box_item.is_draft ───────────────────────────────────────────────────────
ALTER TABLE box_item ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index — the only common query is "the drafts in this box".
CREATE INDEX IF NOT EXISTS idx_box_item_draft ON box_item(box_id) WHERE is_draft;

-- ─── box_scan ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS box_scan (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id             UUID NOT NULL REFERENCES box(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'processing'
                       CHECK (status IN ('processing', 'complete', 'failed')),
  total_found        INTEGER NOT NULL DEFAULT 0,
  matched_count      INTEGER NOT NULL DEFAULT 0,
  new_count          INTEGER NOT NULL DEFAULT 0,
  flagged_count      INTEGER NOT NULL DEFAULT 0,
  illegible_count    INTEGER NOT NULL DEFAULT 0,
  -- string[] of entries the LLM could not read
  illegible_entries  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ item_assessment_id, verdict, item_name }] — matched items whose verdict
  -- (SELL/DONATE/DISCARD/REVISIT) means they should not be shipped.
  flagged_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ box_item_id, item_assessment_id, item_name, kind, verdict }] — the draft
  -- items added to the box for review. kind is 'matched' (existing unpacked
  -- inventory item) or 'new' (freshly created from the label).
  proposed_items     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_box_scan_box_id ON box_scan(box_id);

-- CREATE TRIGGER has no IF NOT EXISTS — drop-then-create keeps this re-runnable.
DROP TRIGGER IF EXISTS trg_box_scan_updated_at ON box_scan;
CREATE TRIGGER trg_box_scan_updated_at
  BEFORE UPDATE ON box_scan
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS on, no policy: matches the rest of the schema. All app access to box_scan
-- goes through the service-role admin client (getAdminClient), which bypasses
-- RLS; enabling it keeps anon/authenticated clients locked out by default.
ALTER TABLE box_scan ENABLE ROW LEVEL SECURITY;
