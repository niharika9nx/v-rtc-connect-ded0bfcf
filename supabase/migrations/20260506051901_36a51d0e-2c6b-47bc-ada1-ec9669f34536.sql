-- 1. Clamp role in handle_new_user to prevent admin self-registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  raw_role text;
  user_role text;
  phone_val bigint;
  user_name text;
  notif_msg text;
BEGIN
  raw_role := new.raw_user_meta_data->>'role';
  -- Only allow self-registration as student or faculty. Admin must be granted by an existing admin.
  IF raw_role IN ('student', 'faculty') THEN
    user_role := raw_role;
  ELSE
    user_role := 'student';
  END IF;

  BEGIN
    phone_val := NULLIF(new.raw_user_meta_data->>'phone', '')::bigint;
  EXCEPTION WHEN others THEN
    phone_val := NULL;
  END;

  user_name := COALESCE(new.raw_user_meta_data->>'name', new.email);

  INSERT INTO public.profiles (id, name, role, phone, gender, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    user_role,
    phone_val,
    new.raw_user_meta_data->>'gender',
    new.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, user_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Notify all admins about new student/faculty account creation
  notif_msg := 'A new ' || user_role || ' ' || COALESCE(user_name, '') ||
    ' created an account at ' ||
    to_char(now() AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') ||
    ' , date: ' ||
    to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY');

  INSERT INTO public.alerts (user_id, type, message, status)
  SELECT ur.user_id, 'new_account', notif_msg, 'unread'
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2. Defence-in-depth: admins can directly read pass-documents bucket
DROP POLICY IF EXISTS "Admins can read pass-documents" ON storage.objects;
CREATE POLICY "Admins can read pass-documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pass-documents' AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role));