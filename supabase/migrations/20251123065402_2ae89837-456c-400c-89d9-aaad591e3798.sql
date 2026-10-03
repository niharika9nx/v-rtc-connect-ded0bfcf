-- Fix function search_path security issues
-- Recreate handle_new_user with proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, role, phone, gender, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    new.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    new.id,
    (new.raw_user_meta_data->>'role')::public.app_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN new;
END;
$function$;

-- Recreate sync_profile_email with proper search_path
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- Create a secure view for announcements that hides admin_id from non-admins
CREATE OR REPLACE VIEW public.public_announcements AS
SELECT id, message, created_at
FROM public.announcements
ORDER BY created_at DESC;

-- Grant access to the view
GRANT SELECT ON public.public_announcements TO authenticated;
GRANT SELECT ON public.public_announcements TO anon;

-- Enable RLS on the view
ALTER VIEW public.public_announcements SET (security_invoker = on);