-- Optimize RLS policies by using subquery for auth.uid()
-- This prevents re-evaluation of auth.uid() for each row, improving performance

-- PROFILES TABLE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR SELECT 
USING (false);

-- ALERTS TABLE
DROP POLICY IF EXISTS "Users can view own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Admins can manage alerts" ON public.alerts;
DROP POLICY IF EXISTS "Deny anonymous access to alerts" ON public.alerts;

CREATE POLICY "Users can view own alerts" 
ON public.alerts 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own alerts" 
ON public.alerts 
FOR UPDATE 
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own alerts" 
ON public.alerts 
FOR DELETE 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own alerts" 
ON public.alerts 
FOR INSERT 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage alerts" 
ON public.alerts 
FOR ALL 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to alerts" 
ON public.alerts 
FOR SELECT 
USING (false);

-- ANNOUNCEMENTS TABLE
DROP POLICY IF EXISTS "Admins can create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;

CREATE POLICY "Admins can create announcements" 
ON public.announcements 
FOR INSERT 
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can delete announcements" 
ON public.announcements 
FOR DELETE 
USING (has_role((select auth.uid()), 'admin'::app_role));

-- BUS_DETAILS TABLE
DROP POLICY IF EXISTS "Admins can manage bus details" ON public.bus_details;

CREATE POLICY "Admins can manage bus details" 
ON public.bus_details 
FOR ALL 
USING (has_role((select auth.uid()), 'admin'::app_role));

-- COMPLAINTS TABLE
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can delete own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Deny anonymous access to complaints" ON public.complaints;

CREATE POLICY "Users can view own complaints" 
ON public.complaints 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create complaints" 
ON public.complaints 
FOR INSERT 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own complaints" 
ON public.complaints 
FOR DELETE 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all complaints" 
ON public.complaints 
FOR SELECT 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update complaints" 
ON public.complaints 
FOR UPDATE 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to complaints" 
ON public.complaints 
FOR SELECT 
USING (false);

-- FEE_HISTORY TABLE
DROP POLICY IF EXISTS "Users can view own fee history" ON public.fee_history;
DROP POLICY IF EXISTS "Admins can manage fee history" ON public.fee_history;
DROP POLICY IF EXISTS "Deny anonymous access to fee_history" ON public.fee_history;

CREATE POLICY "Users can view own fee history" 
ON public.fee_history 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can manage fee history" 
ON public.fee_history 
FOR ALL 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to fee_history" 
ON public.fee_history 
FOR SELECT 
USING (false);

-- PASSES TABLE
DROP POLICY IF EXISTS "Users can view own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can insert own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can update own passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can view all passes" ON public.passes;
DROP POLICY IF EXISTS "Deny anonymous access to passes" ON public.passes;

CREATE POLICY "Users can view own passes" 
ON public.passes 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own passes" 
ON public.passes 
FOR INSERT 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own passes" 
ON public.passes 
FOR UPDATE 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all passes" 
ON public.passes 
FOR SELECT 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Deny anonymous access to passes" 
ON public.passes 
FOR SELECT 
USING (false);

-- USER_ROLES TABLE
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Deny anonymous access to user_roles" 
ON public.user_roles 
FOR SELECT 
USING (false);