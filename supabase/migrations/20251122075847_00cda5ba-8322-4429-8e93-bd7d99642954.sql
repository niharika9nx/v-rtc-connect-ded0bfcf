-- CRITICAL SECURITY FIX: Implement proper role management with separate user_roles table

-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'faculty', 'student');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Create index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- 4. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policy for user_roles (users can view their own roles)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- 6. Create security definer function to check roles securely
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 7. Migrate existing data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::public.app_role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Update all RLS policies to use the secure has_role() function

-- ALERTS TABLE
DROP POLICY IF EXISTS "Admins can manage alerts" ON public.alerts;
CREATE POLICY "Admins can manage alerts"
ON public.alerts
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ANNOUNCEMENTS TABLE
DROP POLICY IF EXISTS "Admins can create announcements" ON public.announcements;
CREATE POLICY "Admins can create announcements"
ON public.announcements
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- BUS_DETAILS TABLE
DROP POLICY IF EXISTS "Admins can manage bus details" ON public.bus_details;
CREATE POLICY "Admins can manage bus details"
ON public.bus_details
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- COMPLAINTS TABLE
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
CREATE POLICY "Admins can update complaints"
ON public.complaints
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
CREATE POLICY "Admins can view all complaints"
ON public.complaints
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- FEE_HISTORY TABLE
DROP POLICY IF EXISTS "Admins can manage fee history" ON public.fee_history;
CREATE POLICY "Admins can manage fee history"
ON public.fee_history
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- PASSES TABLE
DROP POLICY IF EXISTS "Admins can view all passes" ON public.passes;
CREATE POLICY "Admins can view all passes"
ON public.passes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES TABLE
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 9. Update the handle_new_user trigger function to also insert into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, name, role, phone, gender)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'gender'
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