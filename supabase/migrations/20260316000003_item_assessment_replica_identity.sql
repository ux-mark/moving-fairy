-- Enable REPLICA IDENTITY FULL on item_assessment so that Supabase Realtime
-- can evaluate RLS policies on UPDATE events and deliver them to subscribers.
-- Without this, UPDATE events are silently dropped because the WAL only
-- contains the primary key in the old tuple, which is insufficient for RLS.
ALTER TABLE item_assessment REPLICA IDENTITY FULL;
