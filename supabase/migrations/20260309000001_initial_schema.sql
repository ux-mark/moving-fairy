-- Moving Fairy — Initial Schema Migration
-- Based on .specs/data-model.md

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'country_code') THEN
    CREATE TYPE country_code AS ENUM ('US', 'IE', 'AU', 'CA', 'UK', 'NZ');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onward_timeline') THEN
    CREATE TYPE onward_timeline AS ENUM ('1_2yr', '3_5yr', '5yr_plus', 'undecided');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verdict') THEN
    CREATE TYPE verdict AS ENUM ('SELL', 'DONATE', 'DISCARD', 'SHIP', 'CARRY', 'DECIDE_LATER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'box_size') THEN
    CREATE TYPE box_size AS ENUM ('XS', 'S', 'M', 'L');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'box_type') THEN
    CREATE TYPE box_type AS ENUM ('standard', 'checked_luggage', 'carryon', 'single_item');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'box_status') THEN
    CREATE TYPE box_status AS ENUM ('packing', 'packed', 'shipped', 'arrived');
  END IF;
END $$;

-- ============================================================
-- Shared trigger function: update_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- user_profile
-- ============================================================
CREATE TABLE user_profile (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  departure_country country_code NOT NULL,
  arrival_country   country_code NOT NULL,
  onward_country    country_code NULL,
  onward_timeline   onward_timeline NULL,
  equipment         JSONB NOT NULL DEFAULT '{}',
  anthropic_api_key TEXT NULL,

  CONSTRAINT chk_departure_ne_arrival
    CHECK (departure_country != arrival_country),
  CONSTRAINT chk_onward_ne_arrival
    CHECK (onward_country IS NULL OR onward_country != arrival_country),
  CONSTRAINT chk_onward_timeline_requires_country
    CHECK (onward_timeline IS NULL OR onward_country IS NOT NULL)
);

CREATE TRIGGER trg_user_profile_updated_at
  BEFORE UPDATE ON user_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- session
-- ============================================================
CREATE TABLE session (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_profile_id  UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  messages         JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_session_user_profile_id ON session(user_profile_id);

CREATE TRIGGER trg_session_updated_at
  BEFORE UPDATE ON session
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- item_assessment
-- ============================================================
CREATE TABLE item_assessment (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id        UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  session_id             UUID NULL REFERENCES session(id) ON DELETE SET NULL,
  item_name              TEXT NOT NULL,
  item_description       TEXT NULL,
  verdict                verdict NOT NULL,
  advice_text            TEXT NULL,
  image_url              TEXT NULL,
  voltage_compatible     BOOLEAN NULL,
  needs_transformer      BOOLEAN NULL,
  estimated_ship_cost    DECIMAL NULL,
  currency               TEXT NULL,
  estimated_replace_cost DECIMAL NULL,
  replace_currency       TEXT NULL,
  user_confirmed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_item_assessment_user_profile_id ON item_assessment(user_profile_id);
CREATE INDEX idx_item_assessment_user_verdict ON item_assessment(user_profile_id, verdict);

CREATE TRIGGER trg_item_assessment_updated_at
  BEFORE UPDATE ON item_assessment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- box
-- ============================================================
CREATE TABLE box (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id    UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  box_type           box_type NOT NULL DEFAULT 'standard',
  size               box_size NULL,
  cbm                DECIMAL NULL,
  room_name          TEXT NOT NULL,
  box_number         INTEGER NOT NULL,
  label              TEXT NOT NULL,
  manifest_image_url TEXT NULL,
  status             box_status NOT NULL DEFAULT 'packing',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_box_room_number
    UNIQUE (user_profile_id, room_name, box_number),
  CONSTRAINT uq_box_label
    UNIQUE (user_profile_id, label)
);

CREATE INDEX idx_box_user_profile_id ON box(user_profile_id);
CREATE INDEX idx_box_user_room ON box(user_profile_id, room_name);

CREATE TRIGGER trg_box_updated_at
  BEFORE UPDATE ON box
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- box_item
-- ============================================================
CREATE TABLE box_item (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id               UUID NOT NULL REFERENCES box(id) ON DELETE CASCADE,
  item_assessment_id   UUID NULL REFERENCES item_assessment(id) ON DELETE SET NULL,
  item_name            TEXT NOT NULL,
  quantity             INTEGER NOT NULL DEFAULT 1,
  from_handwritten_list BOOLEAN NOT NULL DEFAULT FALSE,
  needs_assessment     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX box_item_assessment_unique
  ON box_item(item_assessment_id)
  WHERE item_assessment_id IS NOT NULL;

CREATE INDEX idx_box_item_box_id ON box_item(box_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- RLS enabled on all tables. Policies will be added once Supabase Auth is configured.
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE box ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_item ENABLE ROW LEVEL SECURITY;
