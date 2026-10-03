CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  phone_val bigint;
  user_name text;
  notif_msg text;
BEGIN
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'student');

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

  IF user_role IS NOT NULL AND user_role != '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, user_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Notify all admins about new student/faculty account creation
  IF user_role IN ('student', 'faculty') THEN
    notif_msg := 'A new ' || user_role || ' ' || COALESCE(user_name, '') ||
      ' created an account at ' ||
      to_char(now() AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') ||
      ' , date: ' ||
      to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY');

    INSERT INTO public.alerts (user_id, type, message, status)
    SELECT ur.user_id, 'new_account', notif_msg, 'unread'
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;

  RETURN new;
END;
$function$;