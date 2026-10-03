-- Fix overlapping DELETE policies on alerts table
-- Split the "FOR ALL" admin policy into specific operation policies

-- Remove the broad "FOR ALL" policy
DROP POLICY IF EXISTS "Admins can manage alerts" ON public.alerts;

-- Create specific admin policies for each operation
CREATE POLICY "Admins can select all alerts" 
ON public.alerts 
FOR SELECT 
USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can insert alerts" 
ON public.alerts 
FOR INSERT 
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update all alerts" 
ON public.alerts 
FOR UPDATE 
USING (has_role((select auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can delete all alerts" 
ON public.alerts 
FOR DELETE 
USING (has_role((select auth.uid()), 'admin'::app_role));