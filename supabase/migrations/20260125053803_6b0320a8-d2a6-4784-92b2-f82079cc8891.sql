-- =============================================
-- COMPREHENSIVE RLS SECURITY & PERFORMANCE FIX
-- =============================================

-- 1. FIX ANNOUNCEMENTS TABLE
-- Remove duplicate/conflicting SELECT policies
DROP POLICY IF EXISTS "Select announcements for authenticated users only" ON public.announcements;
DROP POLICY IF EXISTS "view_announcements_authenticated" ON public.announcements;

-- Create single optimized SELECT policy for authenticated users only
CREATE POLICY "Authenticated users can view announcements" 
ON public.announcements 
FOR SELECT 
TO authenticated
USING (true);

-- 2. FIX BUS_DETAILS TABLE
-- Remove duplicate/conflicting SELECT policies
DROP POLICY IF EXISTS "Anyone can view bus details" ON public.bus_details;
DROP POLICY IF EXISTS "Select bus_details for authenticated users only" ON public.bus_details;

-- Create single optimized SELECT policy for authenticated users only
CREATE POLICY "Authenticated users can view bus details" 
ON public.bus_details 
FOR SELECT 
TO authenticated
USING (true);

-- 3. FIX ALERTS TABLE - ensure policies are scoped to authenticated role
DROP POLICY IF EXISTS "alerts_select_policy" ON public.alerts;
DROP POLICY IF EXISTS "alerts_insert_policy" ON public.alerts;
DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;
DROP POLICY IF EXISTS "alerts_delete_policy" ON public.alerts;

CREATE POLICY "alerts_select_policy" 
ON public.alerts 
FOR SELECT 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()));

CREATE POLICY "alerts_insert_policy" 
ON public.alerts 
FOR INSERT 
TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()));

CREATE POLICY "alerts_update_policy" 
ON public.alerts 
FOR UPDATE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()));

CREATE POLICY "alerts_delete_policy" 
ON public.alerts 
FOR DELETE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()));

-- 4. FIX BUS_REQUESTS TABLE - scope to authenticated role
DROP POLICY IF EXISTS "Users can view own bus requests" ON public.bus_requests;
DROP POLICY IF EXISTS "Admins can view all bus requests" ON public.bus_requests;
DROP POLICY IF EXISTS "Users can create bus requests" ON public.bus_requests;
DROP POLICY IF EXISTS "Admins can update bus requests" ON public.bus_requests;
DROP POLICY IF EXISTS "Users can delete own pending requests" ON public.bus_requests;
DROP POLICY IF EXISTS "Admins can delete bus requests" ON public.bus_requests;

CREATE POLICY "Users can view own bus requests" 
ON public.bus_requests 
FOR SELECT 
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all bus requests" 
ON public.bus_requests 
FOR SELECT 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Users can create bus requests" 
ON public.bus_requests 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can update bus requests" 
ON public.bus_requests 
FOR UPDATE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Users can delete own pending requests" 
ON public.bus_requests 
FOR DELETE 
TO authenticated
USING (user_id = (SELECT auth.uid()) AND status = 'pending');

CREATE POLICY "Admins can delete bus requests" 
ON public.bus_requests 
FOR DELETE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- 5. FIX COMPLAINTS TABLE - add admin delete and scope to authenticated
DROP POLICY IF EXISTS "view_complaints_policy" ON public.complaints;
DROP POLICY IF EXISTS "insert_complaints_policy" ON public.complaints;
DROP POLICY IF EXISTS "delete_complaints_policy" ON public.complaints;

CREATE POLICY "view_complaints_policy" 
ON public.complaints 
FOR SELECT 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()));

CREATE POLICY "insert_complaints_policy" 
ON public.complaints 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "delete_complaints_policy" 
ON public.complaints 
FOR DELETE 
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Add admin delete policy for complaints (was missing)
CREATE POLICY "Admins can delete complaints" 
ON public.complaints 
FOR DELETE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- 6. FIX FEE_HISTORY TABLE - scope to authenticated
DROP POLICY IF EXISTS "view_fee_history_policy" ON public.fee_history;
DROP POLICY IF EXISTS "admin_insert_fee_history" ON public.fee_history;
DROP POLICY IF EXISTS "admin_update_fee_history" ON public.fee_history;

CREATE POLICY "view_fee_history_policy" 
ON public.fee_history 
FOR SELECT 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()));

CREATE POLICY "admin_insert_fee_history" 
ON public.fee_history 
FOR INSERT 
TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "admin_update_fee_history" 
ON public.fee_history 
FOR UPDATE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- 7. FIX PASSES TABLE - scope to authenticated
DROP POLICY IF EXISTS "view_passes_policy" ON public.passes;

CREATE POLICY "view_passes_policy" 
ON public.passes 
FOR SELECT 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR user_id = (SELECT auth.uid()));

-- 8. FIX PROFILES TABLE - scope to authenticated
DROP POLICY IF EXISTS "view_profiles_policy" ON public.profiles;

CREATE POLICY "view_profiles_policy" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR id = (SELECT auth.uid()));

-- 9. FIX USER_ROLES TABLE - remove redundant deny policy, keep user view policy
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- 10. FIX ADMIN POLICIES ON BUS_DETAILS - scope to authenticated
DROP POLICY IF EXISTS "Admins can insert bus details" ON public.bus_details;
DROP POLICY IF EXISTS "Admins can update bus details" ON public.bus_details;
DROP POLICY IF EXISTS "Admins can delete bus details" ON public.bus_details;

CREATE POLICY "Admins can insert bus details" 
ON public.bus_details 
FOR INSERT 
TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update bus details" 
ON public.bus_details 
FOR UPDATE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can delete bus details" 
ON public.bus_details 
FOR DELETE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- 11. FIX ADMIN POLICIES ON ANNOUNCEMENTS - scope to authenticated  
DROP POLICY IF EXISTS "admin_insert_announcements" ON public.announcements;
DROP POLICY IF EXISTS "admin_delete_announcements" ON public.announcements;

CREATE POLICY "admin_insert_announcements" 
ON public.announcements 
FOR INSERT 
TO authenticated
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "admin_delete_announcements" 
ON public.announcements 
FOR DELETE 
TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role));