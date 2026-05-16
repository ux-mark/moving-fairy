-- ============================================================
-- seller_settings: per-user default condition for new listings
-- Owner-scoped via existing RLS on seller_settings. NULL = no
-- preference; the listing form falls back to "pick on each".
-- Mirrors the `condition` enum on listing.
-- ============================================================
ALTER TABLE seller_settings
  ADD COLUMN IF NOT EXISTS default_condition TEXT NULL
    CHECK (default_condition IN ('excellent', 'like_new', 'good', 'fair'));
