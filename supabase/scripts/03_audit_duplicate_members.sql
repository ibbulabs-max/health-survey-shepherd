-- 03_resolve_duplicate_members.sql
-- CAUTION: Destructive Operation!
-- Resolves duplicate members within the same house that have the exact same member_id.

BEGIN;

-- For now, just a dry-run check to see if we even have this problem
SELECT house_uuid, member_id, count(*) as c
FROM house_members
WHERE member_id IS NOT NULL AND member_id != ''
GROUP BY house_uuid, member_id
HAVING count(*) > 1;

COMMIT;
