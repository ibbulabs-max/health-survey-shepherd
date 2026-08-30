-- 01_audit_duplicate_houses.sql
-- This script identifies Duplicate Houses based on `house_id`
-- and returns a report of the affected houses and their members.

-- 1. Identify duplicated house_ids
WITH duplicate_houses AS (
    SELECT house_id, COUNT(*), array_agg(id) as internal_ids
    FROM houses
    GROUP BY house_id
    HAVING COUNT(*) > 1
)
-- 2. Fetch full details for the duplicates
SELECT 
    h.id AS internal_house_id,
    h.house_id AS external_house_id,
    h.created_at,
    (SELECT COUNT(*) FROM house_members m WHERE m.house_id = h.id) as member_count,
    (SELECT string_agg(m.name, ', ') FROM house_members m WHERE m.house_id = h.id) as member_names
FROM houses h
JOIN duplicate_houses dh ON h.house_id = dh.house_id
ORDER BY h.house_id, h.created_at ASC;
