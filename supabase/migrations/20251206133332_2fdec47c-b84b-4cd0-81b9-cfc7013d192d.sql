-- Fix RLS policies for profiles table to use has_role function correctly
DROP POLICY IF EXISTS "view_profiles_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "view_profiles_anon" ON public.profiles;

CREATE POLICY "view_profiles_policy" ON public.profiles
FOR SELECT
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR id = (SELECT auth.uid())
);

-- Fix RLS policies for passes table
DROP POLICY IF EXISTS "view_passes_authenticated" ON public.passes;
DROP POLICY IF EXISTS "view_passes_anon" ON public.passes;

CREATE POLICY "view_passes_policy" ON public.passes
FOR SELECT
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);

-- Fix RLS policies for fee_history table
DROP POLICY IF EXISTS "view_fee_history_authenticated" ON public.fee_history;
DROP POLICY IF EXISTS "view_fee_history_anon" ON public.fee_history;

CREATE POLICY "view_fee_history_policy" ON public.fee_history
FOR SELECT
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);

-- Fix RLS policies for complaints table
DROP POLICY IF EXISTS "view_complaints_authenticated" ON public.complaints;

CREATE POLICY "view_complaints_policy" ON public.complaints
FOR SELECT
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);

-- Fix RLS policies for alerts table (use has_role instead of auth.role())
DROP POLICY IF EXISTS "alerts_select_policy" ON public.alerts;
DROP POLICY IF EXISTS "alerts_insert_policy" ON public.alerts;
DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;
DROP POLICY IF EXISTS "alerts_delete_policy" ON public.alerts;

CREATE POLICY "alerts_select_policy" ON public.alerts
FOR SELECT
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);

CREATE POLICY "alerts_insert_policy" ON public.alerts
FOR INSERT
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);

CREATE POLICY "alerts_update_policy" ON public.alerts
FOR UPDATE
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
)
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);

CREATE POLICY "alerts_delete_policy" ON public.alerts
FOR DELETE
USING (
  public.has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);

-- Add INSERT policy for complaints (missing)
CREATE POLICY "insert_complaints_policy" ON public.complaints
FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

-- Add DELETE policy for complaints (for users to delete their own)
CREATE POLICY "delete_complaints_policy" ON public.complaints
FOR DELETE
USING (user_id = (SELECT auth.uid()));

-- Add admin UPDATE policy for fee_history
CREATE POLICY "admin_update_fee_history" ON public.fee_history
FOR UPDATE
USING (public.has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Add admin INSERT policy for fee_history
CREATE POLICY "admin_insert_fee_history" ON public.fee_history
FOR INSERT
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Add admin DELETE policy for announcements
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
CREATE POLICY "admin_delete_announcements" ON public.announcements
FOR DELETE
USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Add admin INSERT policy for announcements
CREATE POLICY "admin_insert_announcements" ON public.announcements
FOR INSERT
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));