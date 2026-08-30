-- Add unique constraint on house_id
ALTER TABLE houses ADD CONSTRAINT houses_house_id_key UNIQUE (house_id);

-- Add unique constraint on member_id within a house
ALTER TABLE house_members ADD CONSTRAINT house_members_house_uuid_member_id_key UNIQUE (house_uuid, member_id);
