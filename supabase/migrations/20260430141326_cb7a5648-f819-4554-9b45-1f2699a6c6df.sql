-- 1) Fix alerts UPDATE (soft delete) policy
DROP POLICY IF EXISTS "alerts_delete_policy" ON public.alerts;

CREATE POLICY "alerts_soft_delete_own"
ON public.alerts
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND (
    public.has_role((SELECT auth.uid()), 'student'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'faculty'::public.app_role)
  )
)
WITH CHECK (
  deleted_at IS NOT NULL
  AND user_id = (SELECT auth.uid())
);

-- 2) Lock down user_roles
CREATE POLICY "Only admins can insert user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Only admins can update user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Only admins can delete user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- 3) Remove duplicate INSERT policy on pass-documents bucket
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
