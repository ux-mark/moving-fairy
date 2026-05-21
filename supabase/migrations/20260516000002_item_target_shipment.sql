-- ============================================================
-- Per-item shipment leg assignment
-- Adds: item_assessment.target_shipment_id (nullable FK → shipment).
-- Null means "fall back to the box's shipment / leg 1" — preserves
-- the existing behaviour for every row that already exists.
-- ============================================================

ALTER TABLE item_assessment
  ADD COLUMN IF NOT EXISTS target_shipment_id UUID NULL
    REFERENCES shipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS item_assessment_target_shipment_id_idx
  ON item_assessment(target_shipment_id);
