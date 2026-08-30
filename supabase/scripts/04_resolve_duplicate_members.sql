-- 03_resolve_duplicate_members.sql
-- Safely add unique constraint on house_members
BEGIN;

-- First, ensure no duplicates exist
CREATE TEMP TABLE duplicate_members AS
SELECT house_uuid, member_id, min(id) as canonical_id
FROM house_members
WHERE member_id IS NOT NULL AND member_id != ''
GROUP BY house_uuid, member_id
HAVING count(*) > 1;

-- Delete duplicates (keeping the oldest)
DELETE FROM house_members hm
USING duplicate_members dm
WHERE hm.house_uuid = dm.house_uuid 
  AND hm.member_id = dm.member_id 
  AND hm.id != dm.canonical_id;

-- Add the unique constraint
ALTER TABLE house_members ADD CONSTRAINT house_members_house_uuid_member_id_key UNIQUE (house_uuid, member_id);

COMMIT;
