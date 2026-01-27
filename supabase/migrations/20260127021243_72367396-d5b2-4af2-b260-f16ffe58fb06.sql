-- Remove WITH CHECK to see if that's the issue
DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;

CREATE POLICY "alerts_update_policy" ON public.alerts
FOR UPDATE TO authenticated
USING (user_id = auth.uid());