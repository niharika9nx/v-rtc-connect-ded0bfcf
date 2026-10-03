-- Simplify the UPDATE policy - use direct auth.uid() without subselect
DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;

CREATE POLICY "alerts_update_policy" ON public.alerts
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR user_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR user_id = auth.uid()
);