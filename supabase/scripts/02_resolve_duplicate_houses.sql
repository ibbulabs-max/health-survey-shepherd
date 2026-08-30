-- 02_resolve_duplicate_houses.sql
-- CAUTION: Destructive Operation!
-- This script resolves duplicate houses by:
-- 1. Keeping the oldest house record (canonical).
-- 2. Moving all members from duplicate houses to the canonical house.
-- 3. Deleting the duplicate house records.

BEGIN;

-- Create a temporary table to store the canonical (oldest) internal ID for each external house_id
CREATE TEMP TABLE canonical_houses AS
SELECT house_id, min(id) as canonical_id
FROM houses
GROUP BY house_id
HAVING count(*) > 1;

-- 1. Re-parent members to the canonical house
UPDATE house_members hm
SET house_id = ch.canonical_id
FROM houses h
JOIN canonical_houses ch ON h.house_id = ch.house_id
WHERE hm.house_id = h.id 
  AND h.id != ch.canonical_id;

-- 2. Delete the duplicate houses
DELETE FROM houses h
USING canonical_houses ch
WHERE h.house_id = ch.house_id
  AND h.id != ch.canonical_id;

-- Now we can safely apply the unique constraint
ALTER TABLE houses ADD CONSTRAINT houses_house_id_key UNIQUE (house_id);

COMMIT;
