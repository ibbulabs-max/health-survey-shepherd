-- RPC for Admin to reset user PIN
CREATE OR REPLACE FUNCTION admin_reset_user_pin(target_user_id uuid, new_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_like(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Must be an admin.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_pin, gen_salt('bf'))
  WHERE id = target_user_id;
END;
$$;

-- RPC for Admin to update user role
CREATE OR REPLACE FUNCTION admin_update_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_like(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Must be an admin.';
  END IF;

  UPDATE public.user_roles
  SET role = new_role
  WHERE user_id = target_user_id;
END;
$$;

-- RPC for Admin to update CSW's supervisor
CREATE OR REPLACE FUNCTION admin_update_supervisor(target_csw_id uuid, new_supervisor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_like(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Must be an admin.';
  END IF;

  UPDATE public.team_memberships
  SET supervisor_id = new_supervisor_id
  WHERE csw_id = target_csw_id;
END;
$$;
