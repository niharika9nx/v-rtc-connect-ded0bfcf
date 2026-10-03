
-- Fix handle_new_user to cast phone to bigint
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  phone_val bigint;
BEGIN
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'student');

  BEGIN
    phone_val := NULLIF(new.raw_user_meta_data->>'phone', '')::bigint;
  EXCEPTION WHEN others THEN
    phone_val := NULL;
  END;

  INSERT INTO public.profiles (id, name, role, phone, gender, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    user_role,
    phone_val,
    new.raw_user_meta_data->>'gender',
    new.email
  );

  IF user_role IS NOT NULL AND user_role != '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, user_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$function$;

-- Lock down trigger-only SECURITY DEFINER functions so anon/authenticated cannot invoke them directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_duplicate_pass_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role must remain callable by signed-in users (used in RLS), but block anon
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
