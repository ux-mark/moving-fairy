-- Anon SELECT policy on item_assessment, scoped to rows joined from
-- public+published(/reserved) listings. Without this, the buyer-side
-- query `listing.select('*, item_assessment(...)')` returns
-- item_assessment as null because the anon role has no SELECT grant on
-- the table, and cards fall back to "Untitled item" with no images.

DROP POLICY IF EXISTS "Anon can view item assessments for public listings" ON item_assessment;
CREATE POLICY "Anon can view item assessments for public listings"
  ON item_assessment FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT item_assessment_id FROM listing
      WHERE visibility = 'public'
        AND listing_status IN ('published', 'reserved')
    )
  );
