-- Enable Supabase Realtime on the remaining panel data tables:
-- box, box_item, listing, shipment, item_conversation_message.
--
-- Mirrors 20260316000003_item_assessment_replica_identity.sql: REPLICA IDENTITY
-- FULL is required so Realtime can evaluate RLS policies on UPDATE/DELETE events
-- (the default WAL old-tuple only carries the primary key, which is insufficient).
-- Owner-scoped SELECT policies already exist on all five tables
-- (20260315000001, 20260316000002, 20260516000001), so no new policies needed.
--
-- Structure only — no row data is read or modified.

ALTER TABLE box REPLICA IDENTITY FULL;
ALTER TABLE box_item REPLICA IDENTITY FULL;
ALTER TABLE listing REPLICA IDENTITY FULL;
ALTER TABLE shipment REPLICA IDENTITY FULL;
ALTER TABLE item_conversation_message REPLICA IDENTITY FULL;

-- Add to the supabase_realtime publication (idempotent: skip if already added).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['box', 'box_item', 'listing', 'shipment', 'item_conversation_message']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
