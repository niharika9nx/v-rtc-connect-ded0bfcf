-- Fix the NULL role for user niharikachinimilli1@gmail.com
UPDATE public.user_roles 
SET role = 'student'::app_role 
WHERE user_id = '07891608-1956-4263-8f6d-4fd2edc99de8' AND role IS NULL;

-- Also fix profile role mismatch: vesbusrtc@gmail.com has faculty role but profile says student
UPDATE public.profiles 
SET role = 'faculty' 
WHERE id = 'f1917b10-740a-4dbf-966b-5a2bf7a5fc0e';

-- Fix the handle_new_user function to ensure role is never NULL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
BEGIN
  -- Get the role from metadata, default to 'student' if NULL
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
  
  INSERT INTO public.profiles (id, name, role, phone, gender, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    user_role,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    new.email
  );
  
  -- Only insert if role is valid (not null/empty)
  IF user_role IS NOT NULL AND user_role != '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      new.id,
      user_role::public.app_role
    )
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN new;
END;
$function$;