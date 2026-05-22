-- ============================================================
-- item_assessment_care
--
-- Plant-care information attached to an assessment. For plants
-- (biosecurity_category = 'plant_matter') Aisling populates this
-- field on the assessment card. Non-plant items leave it null.
--
-- Shape (all keys optional, since partial records are allowed):
--   {
--     light:        text — e.g. "Bright indirect"
--     light_level:  1 | 2 | 3 (1=low, 2=medium, 3=bright)
--     water:        text — e.g. "When dry"
--     water_level:  1 | 2 | 3 (1=sparse, 2=medium, 3=frequent)
--     soil:         text — e.g. "Standard mix"
--     feed:         text — e.g. "Monthly"
--     feed_level:   1 | 2 | 3 (1=sparse, 2=monthly, 3=weekly)
--     summary:      one-sentence prose
--   }
-- ============================================================

ALTER TABLE item_assessment
  ADD COLUMN IF NOT EXISTS care JSONB NULL;
