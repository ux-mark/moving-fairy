-- Make box_item.item_name nullable — only needed for unassessed items.
-- For assessed items (item_assessment_id IS NOT NULL), the canonical name
-- comes from item_assessment.item_name.
ALTER TABLE box_item ALTER COLUMN item_name DROP NOT NULL;

-- Clear stale copies on assessed items
UPDATE box_item
SET item_name = NULL
WHERE item_assessment_id IS NOT NULL;
