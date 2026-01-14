-- Drop the newly created policies that lack performance optimization
DROP POLICY IF EXISTS "Users can insert own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can update own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can delete own passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can insert passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can update passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can delete passes" ON public.passes;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate passes policies with performance-optimized subqueries
CREATE POLICY "Users can insert own passes" 
ON public.passes 
FOR INSERT 
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own passes" 
ON public.passes 
FOR UPDATE 
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own passes" 
ON public.passes 
FOR DELETE 
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can insert passes" 
ON public.passes 
FOR INSERT 
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can update passes" 
ON public.passes 
FOR UPDATE 
USING (public.has_role((SELECT auth.uid()), 'admin'))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can delete passes" 
ON public.passes 
FOR DELETE 
USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Recreate profiles policy with performance-optimized subquery
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);