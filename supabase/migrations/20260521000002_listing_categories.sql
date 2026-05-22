-- ============================================================
-- listing_categories
--
-- Per-listing free-text category + per-seller master list of
-- available categories.
--
-- item_assessment.category    TEXT NULL   — the chosen label for this item.
-- seller_settings.categories  JSONB       — the master list of labels
--                                            available to this seller.
--
-- New categories proposed by Aisling are auto-merged into the master
-- list by the persistence path in src/lib/assess-item.ts.
-- ============================================================

ALTER TABLE item_assessment
  ADD COLUMN IF NOT EXISTS category TEXT NULL;

ALTER TABLE seller_settings
  ADD COLUMN IF NOT EXISTS categories JSONB NOT NULL DEFAULT
    '["Plants","Kitchen & appliances","Furniture","Electronics","Tools & hardware","Home & decor","Outdoor & garden","Other"]'::jsonb;

-- Seed: backfill the imported plant items to Plants. Anything else stays null
-- and the owner will categorise as part of normal review.
UPDATE item_assessment
   SET category = 'Plants'
 WHERE biosecurity_category = 'plant_matter'
   AND category IS NULL;
