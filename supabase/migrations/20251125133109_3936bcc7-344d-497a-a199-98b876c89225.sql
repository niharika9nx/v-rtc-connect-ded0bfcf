-- Fix Critical Security Vulnerabilities
-- Add explicit policies to deny anonymous access to sensitive tables

-- 1. PROFILES TABLE - Block anonymous access to student personal information
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- 2. PASSES TABLE - Block anonymous access to identity documents and bus passes
CREATE POLICY "Deny anonymous access to passes"
ON public.passes
FOR SELECT
TO anon
USING (false);

-- 3. ALERTS TABLE - Block anonymous access to alert messages
CREATE POLICY "Deny anonymous access to alerts"
ON public.alerts
FOR SELECT
TO anon
USING (false);

-- 4. FEE_HISTORY TABLE - Block anonymous access to financial records
CREATE POLICY "Deny anonymous access to fee_history"
ON public.fee_history
FOR SELECT
TO anon
USING (false);

-- 5. COMPLAINTS TABLE - Block anonymous access to complaints
CREATE POLICY "Deny anonymous access to complaints"
ON public.complaints
FOR SELECT
TO anon
USING (false);

-- 6. USER_ROLES TABLE - Block anonymous access to role information
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);

-- 7. PUBLIC_ANNOUNCEMENTS VIEW - Add proper access controls
-- Since it's a view, we need to enable RLS on it
ALTER VIEW public.public_announcements SET (security_invoker = on);

-- Allow authenticated users to view announcements
CREATE POLICY "Authenticated users can view announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (true);

-- Block all anonymous INSERT/UPDATE/DELETE on announcements
CREATE POLICY "Deny anonymous insert on announcements"
ON public.announcements
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Deny anonymous update on announcements"
ON public.announcements
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny anonymous delete on announcements"
ON public.announcements
FOR DELETE
TO anon
USING (false);