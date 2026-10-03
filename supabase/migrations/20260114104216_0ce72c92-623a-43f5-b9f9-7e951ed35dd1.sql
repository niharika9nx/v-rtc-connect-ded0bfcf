-- Fix passes table policies - drop and recreate with proper subqueries
DROP POLICY IF EXISTS "Users can insert own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can update own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can delete own passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can insert passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can update passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can delete passes" ON public.passes;

-- Recreate with performance-optimized subqueries for passes
CREATE POLICY "Users can insert own passes" 
ON public.passes 
FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own passes" 
ON public.passes 
FOR UPDATE 
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own passes" 
ON public.passes 
FOR DELETE 
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can insert passes" 
ON public.passes 
FOR INSERT 
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can update passes" 
ON public.passes 
FOR UPDATE 
USING (has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE POLICY "Admins can delete passes" 
ON public.passes 
FOR DELETE 
USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- Fix profiles policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));