-- Fix the alerts_update_policy to use consistent (SELECT auth.uid() AS uid) pattern
-- This ensures evaluation occurs once per query (performance optimization)
DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;

CREATE POLICY "alerts_update_policy" ON public.alerts
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid() AS uid));

-- Insert a test alert for the recently created user to verify the fix
INSERT INTO public.alerts (user_id, type, message, status, send_at, created_at)
VALUES (
  '416cbfb1-7737-4ecc-97f1-014bb8a915ec',
  'custom',
  'Test alert - Please try dismissing this alert to verify the fix works.',
  'unread',
  now(),
  now()
);