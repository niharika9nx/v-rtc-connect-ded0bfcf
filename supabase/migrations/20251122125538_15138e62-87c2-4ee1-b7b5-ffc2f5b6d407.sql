-- Fix the bus_number default value to be NULL instead of empty string
ALTER TABLE public.profiles ALTER COLUMN bus_number SET DEFAULT NULL;

-- Recreate the trigger function to properly handle NULL values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles (without bus_number initially - it will be NULL)
  INSERT INTO public.profiles (id, name, role, phone, gender, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender',
    new.email
  );
  
  -- Insert into user_roles (the secure source of truth)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    new.id,
    (new.raw_user_meta_data->>'role')::public.app_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN new;
END;
$function$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();