-- Clean up orphaned records due to missing foreign keys or lack of cascade deletes
2: DELETE FROM public.house_members WHERE house_uuid IS NOT NULL AND house_uuid NOT IN (SELECT id FROM public.houses);
3: DELETE FROM public.member_assessments WHERE member_uuid IS NOT NULL AND member_uuid NOT IN (SELECT id FROM public.house_members);
4: DELETE FROM public.member_assessments WHERE house_uuid IS NOT NULL AND house_uuid NOT IN (SELECT id FROM public.houses);
5: DELETE FROM public.follow_ups WHERE member_uuid IS NOT NULL AND member_uuid NOT IN (SELECT id FROM public.house_members);
6: DELETE FROM public.follow_ups WHERE house_uuid IS NOT NULL AND house_uuid NOT IN (SELECT id FROM public.houses);
7: DELETE FROM public.tasks WHERE member_uuid IS NOT NULL AND member_uuid NOT IN (SELECT id FROM public.house_members);
8: DELETE FROM public.tasks WHERE house_uuid IS NOT NULL AND house_uuid NOT IN (SELECT id FROM public.houses);
9: 
10: -- Add ON DELETE CASCADE to ensure no future orphans
11: DO $$
12: DECLARE
13:   fk_name text;
14: BEGIN
15:   -- 1. house_members.house_uuid
16:   FOR fk_name IN 
17:     SELECT tc.constraint_name 
18:     FROM information_schema.table_constraints AS tc 
19:     JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
20:     WHERE tc.table_name = 'house_members' AND kcu.column_name = 'house_uuid' AND tc.constraint_type = 'FOREIGN KEY'
21:   LOOP
22:     EXECUTE 'ALTER TABLE public.house_members DROP CONSTRAINT IF EXISTS ' || fk_name;
23:   END LOOP;
24:   ALTER TABLE public.house_members ADD CONSTRAINT house_members_house_uuid_fkey FOREIGN KEY (house_uuid) REFERENCES public.houses(id) ON DELETE CASCADE;
25: 
26:   -- 2. member_assessments.house_uuid
27:   FOR fk_name IN 
28:     SELECT tc.constraint_name 
29:     FROM information_schema.table_constraints AS tc 
30:     JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
31:     WHERE tc.table_name = 'member_assessments' AND kcu.column_name = 'house_uuid' AND tc.constraint_type = 'FOREIGN KEY'
32:   LOOP
33:     EXECUTE 'ALTER TABLE public.member_assessments DROP CONSTRAINT IF EXISTS ' || fk_name;
34:   END LOOP;
35:   ALTER TABLE public.member_assessments ADD CONSTRAINT member_assessments_house_uuid_fkey FOREIGN KEY (house_uuid) REFERENCES public.houses(id) ON DELETE CASCADE;
36: 
37:   -- 3. member_assessments.member_uuid
38:   FOR fk_name IN 
39:     SELECT tc.constraint_name 
40:     FROM information_schema.table_constraints AS tc 
41:     JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
42:     WHERE tc.table_name = 'member_assessments' AND kcu.column_name = 'member_uuid' AND tc.constraint_type = 'FOREIGN KEY'
43:   LOOP
44:     EXECUTE 'ALTER TABLE public.member_assessments DROP CONSTRAINT IF EXISTS ' || fk_name;
45:   END LOOP;
46:   ALTER TABLE public.member_assessments ADD CONSTRAINT member_assessments_member_uuid_fkey FOREIGN KEY (member_uuid) REFERENCES public.house_members(id) ON DELETE CASCADE;
47: 
48:   -- 4. follow_ups.house_uuid
49:   FOR fk_name IN 
50:     SELECT tc.constraint_name 
51:     FROM information_schema.table_constraints AS tc 
52:     JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
53:     WHERE tc.table_name = 'follow_ups' AND kcu.column_name = 'house_uuid' AND tc.constraint_type = 'FOREIGN KEY'
54:   LOOP
55:     EXECUTE 'ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS ' || fk_name;
56:   END LOOP;
57:   ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_house_uuid_fkey FOREIGN KEY (house_uuid) REFERENCES public.houses(id) ON DELETE CASCADE;
58: 
59:   -- 5. follow_ups.member_uuid
60:   FOR fk_name IN 
61:     SELECT tc.constraint_name 
62:     FROM information_schema.table_constraints AS tc 
63:     JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
64:     WHERE tc.table_name = 'follow_ups' AND kcu.column_name = 'member_uuid' AND tc.constraint_type = 'FOREIGN KEY'
65:   LOOP
66:     EXECUTE 'ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS ' || fk_name;
67:   END LOOP;
68:   ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_member_uuid_fkey FOREIGN KEY (member_uuid) REFERENCES public.house_members(id) ON DELETE CASCADE;
69: 
70: END $$;
