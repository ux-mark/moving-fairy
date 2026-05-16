-- ============================================================
-- Sale Fairy merge — Phase A schema
-- Adds: listing, shipment, enquiry, seller_settings tables.
-- Extends: item_assessment with images JSONB + biosecurity fields.
-- Extends: box with shipment_id FK.
-- All DDL is idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- DO NOT run locally before review — apply via `supabase db push` on the
-- live cloud DB once the user signs off.
-- ============================================================

-- ------------------------------------------------------------
-- 1. item_assessment: images array + biosecurity
-- ------------------------------------------------------------
ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS biosecurity_flag TEXT NULL
  CHECK (biosecurity_flag IN ('none', 'declare', 'high_risk', 'prohibited'));

ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS biosecurity_category TEXT NULL
  CHECK (biosecurity_category IN ('wood', 'plant_matter', 'soil', 'leather', 'food', 'other'));

ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS biosecurity_note TEXT NULL;

ALTER TABLE item_assessment ADD COLUMN IF NOT EXISTS user_confirmed_biosecurity BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill images from legacy single image_url (only where images is still empty).
UPDATE item_assessment
   SET images = jsonb_build_array(image_url)
 WHERE image_url IS NOT NULL
   AND images = '[]'::jsonb;

-- ------------------------------------------------------------
-- 2. shipment (must precede box.shipment_id FK)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipment (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id      UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  leg_order            INTEGER NOT NULL DEFAULT 1,
  label                TEXT NOT NULL,
  origin_country       TEXT NOT NULL,
  destination_country  TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'planned'
                         CHECK (status IN ('planned', 'in_transit', 'arrived', 'cancelled')),
  target_date          DATE NULL,
  share_token          TEXT UNIQUE NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_profile_id, leg_order)
);

CREATE INDEX IF NOT EXISTS shipment_user_profile_id_idx ON shipment(user_profile_id);

ALTER TABLE shipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shipments" ON shipment;
CREATE POLICY "Users can view own shipments"
  ON shipment FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own shipments" ON shipment;
CREATE POLICY "Users can insert own shipments"
  ON shipment FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own shipments" ON shipment;
CREATE POLICY "Users can update own shipments"
  ON shipment FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own shipments" ON shipment;
CREATE POLICY "Users can delete own shipments"
  ON shipment FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. box.shipment_id (added after shipment exists)
-- ------------------------------------------------------------
ALTER TABLE box ADD COLUMN IF NOT EXISTS shipment_id UUID NULL
  REFERENCES shipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS box_shipment_id_idx ON box(shipment_id);

-- ------------------------------------------------------------
-- 4. listing (1:1 with item_assessment for SELL items)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id     UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  item_assessment_id  UUID NOT NULL UNIQUE REFERENCES item_assessment(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL UNIQUE,
  asking_price        NUMERIC(10, 2) NULL,
  currency            TEXT NOT NULL DEFAULT 'USD',
  condition           TEXT NULL CHECK (condition IN ('excellent', 'like_new', 'good', 'fair')),
  brand               TEXT NULL,
  model_name          TEXT NULL,
  dimensions          TEXT NULL,
  included            TEXT NULL,
  details             TEXT NULL,
  listing_status      TEXT NOT NULL DEFAULT 'draft'
                        CHECK (listing_status IN ('draft', 'published', 'reserved', 'sold')),
  visibility          TEXT NOT NULL DEFAULT 'unlisted'
                        CHECK (visibility IN ('unlisted', 'public', 'archived')),
  published_at        TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_user_profile_id_idx ON listing(user_profile_id);
CREATE INDEX IF NOT EXISTS listing_visibility_status_idx ON listing(visibility, listing_status);

ALTER TABLE listing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own listings" ON listing;
CREATE POLICY "Users can view own listings"
  ON listing FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own listings" ON listing;
CREATE POLICY "Users can insert own listings"
  ON listing FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own listings" ON listing;
CREATE POLICY "Users can update own listings"
  ON listing FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own listings" ON listing;
CREATE POLICY "Users can delete own listings"
  ON listing FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

-- Anonymous browse of public, published listings only.
DROP POLICY IF EXISTS "Anon can view public published listings" ON listing;
CREATE POLICY "Anon can view public published listings"
  ON listing FOR SELECT
  TO anon
  USING (visibility = 'public' AND listing_status = 'published');

-- ------------------------------------------------------------
-- 5. enquiry (buyer messages — anon INSERT is BLOCKED at the
--    table level; the public endpoint will use a service-role
--    server function to insert.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id   UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  listing_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
  buyer_email       TEXT NOT NULL,
  buyer_name        TEXT NULL,
  message           TEXT NOT NULL,
  subtotal_cents    INTEGER NULL,
  discount_percent  INTEGER NULL,
  total_cents       INTEGER NULL,
  status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'replied', 'closed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiry_user_profile_id_idx ON enquiry(user_profile_id);
CREATE INDEX IF NOT EXISTS enquiry_status_idx ON enquiry(status);

ALTER TABLE enquiry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own enquiries" ON enquiry;
CREATE POLICY "Users can view own enquiries"
  ON enquiry FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own enquiries" ON enquiry;
CREATE POLICY "Users can update own enquiries"
  ON enquiry FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

-- Note: NO insert policy is created. With RLS enabled and no INSERT policy
-- present, anon and authenticated INSERTs are denied. All buyer enquiries
-- must flow through a service-role server endpoint that bypasses RLS.

-- ------------------------------------------------------------
-- 6. seller_settings (1:1 with user_profile)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_settings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id                 UUID NOT NULL UNIQUE REFERENCES user_profile(id) ON DELETE CASCADE,
  currency                        TEXT NOT NULL DEFAULT 'USD',
  seller_display_name             TEXT NULL,
  contact_email                   TEXT NULL,
  pickup_location_copy            TEXT NULL,
  discount_tiers                  JSONB NOT NULL DEFAULT
                                    '[{"min":3,"max":4,"percent":10},{"min":5,"max":30,"percent":20},{"min":31,"max":null,"percent":30}]'::jsonb,
  biosecurity_destination_preset  TEXT NULL,
  default_collection_name         TEXT NOT NULL DEFAULT 'For sale',
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seller_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seller settings" ON seller_settings;
CREATE POLICY "Users can view own seller settings"
  ON seller_settings FOR SELECT
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own seller settings" ON seller_settings;
CREATE POLICY "Users can insert own seller settings"
  ON seller_settings FOR INSERT
  WITH CHECK (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own seller settings" ON seller_settings;
CREATE POLICY "Users can update own seller settings"
  ON seller_settings FOR UPDATE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own seller settings" ON seller_settings;
CREATE POLICY "Users can delete own seller settings"
  ON seller_settings FOR DELETE
  USING (
    user_profile_id IN (
      SELECT id FROM user_profile WHERE auth_user_id = auth.uid()
    )
  );
