-- Fix the UPDATE policy for alerts to ensure users can update their own alerts
-- Drop and recreate with a cleaner approach

DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;

CREATE POLICY "alerts_update_policy" ON public.alerts
FOR UPDATE TO authenticated
USING (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
)
WITH CHECK (
  has_role((SELECT auth.uid()), 'admin'::app_role) 
  OR user_id = (SELECT auth.uid())
);