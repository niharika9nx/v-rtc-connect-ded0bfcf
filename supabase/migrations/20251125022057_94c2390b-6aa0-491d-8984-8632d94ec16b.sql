-- Fix overlapping RLS policies across all tables

-- BUS_DETAILS TABLE
-- Split "FOR ALL" admin policy into specific operations
DROP POLICY IF EXISTS "Admins can manage bus details" ON public.bus_details;

CREATE POLICY "Admins can select all bus details" 
ON public.bus_details 
FOR SELECT 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can insert bus details" 
ON public.bus_details 
FOR INSERT 
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update bus details" 
ON public.bus_details 
FOR UPDATE 
USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can delete bus details" 
ON public.bus_details 
FOR DELETE 
USING (has_role((select auth.uid()), 'admin'::app_role));

-- COMPLAINTS TABLE
-- Remove deny policy (conflicts with permissive policies)
DROP POLICY IF EXISTS "Deny anonymous access to complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;

-- Recreate admin view policy (already have user view policy)
CREATE POLICY "Admins can view all complaints" 
ON public.complaints 
FOR SELECT 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role));

-- FEE_HISTORY TABLE
-- Split "FOR ALL" admin policy and remove deny policy
DROP POLICY IF EXISTS "Admins can manage fee history" ON public.fee_history;
DROP POLICY IF EXISTS "Deny anonymous access to fee_history" ON public.fee_history;

CREATE POLICY "Admins can select all fee history" 
ON public.fee_history 
FOR SELECT 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can insert fee history" 
ON public.fee_history 
FOR INSERT 
TO authenticated
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update fee history" 
ON public.fee_history 
FOR UPDATE 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can delete fee history" 
ON public.fee_history 
FOR DELETE 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role));

-- PASSES TABLE
-- Remove deny policy
DROP POLICY IF EXISTS "Deny anonymous access to passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can view all passes" ON public.passes;

-- Recreate admin view policy targeting authenticated users only
CREATE POLICY "Admins can view all passes" 
ON public.passes 
FOR SELECT 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role));

-- PROFILES TABLE
-- Split admin update policy and remove deny policy
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate admin policies targeting authenticated users only
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role));

-- USER_ROLES TABLE
-- Remove deny policy
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;

-- Update user view policy to target authenticated users only
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

-- ALERTS TABLE
-- Update existing policies to target authenticated users only
DROP POLICY IF EXISTS "Deny anonymous access to alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Admins can select all alerts" ON public.alerts;

CREATE POLICY "Users can view own alerts" 
ON public.alerts 
FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own alerts" 
ON public.alerts 
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own alerts" 
ON public.alerts 
FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own alerts" 
ON public.alerts 
FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can select all alerts" 
ON public.alerts 
FOR SELECT 
TO authenticated
USING (has_role((select auth.uid()), 'admin'::app_role));

-- Update other table policies to target authenticated users
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can delete own complaints" ON public.complaints;

CREATE POLICY "Users can view own complaints" 
ON public.complaints 
FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create complaints" 
ON public.complaints 
FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own complaints" 
ON public.complaints 
FOR DELETE 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own fee history" ON public.fee_history;

CREATE POLICY "Users can view own fee history" 
ON public.fee_history 
FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can insert own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can update own passes" ON public.passes;

CREATE POLICY "Users can view own passes" 
ON public.passes 
FOR SELECT 
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own passes" 
ON public.passes 
FOR INSERT 
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own passes" 
ON public.passes 
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);