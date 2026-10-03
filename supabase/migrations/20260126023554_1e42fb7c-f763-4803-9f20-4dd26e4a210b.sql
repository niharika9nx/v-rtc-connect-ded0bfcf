-- Add deleted_at column to complaints for soft delete
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Add deleted_at column to announcements for soft delete  
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_complaints_deleted_at ON public.complaints(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_deleted_at ON public.announcements(deleted_at) WHERE deleted_at IS NULL;

-- Add UPDATE policy for complaints so admins can mark as resolved
CREATE POLICY "admin_update_complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));

-- Update SELECT policy for complaints to filter out soft-deleted for non-admins
DROP POLICY IF EXISTS "view_complaints_policy" ON public.complaints;
CREATE POLICY "view_complaints_policy" ON public.complaints
FOR SELECT TO authenticated
USING (
  CASE 
    WHEN has_role((SELECT auth.uid()), 'admin'::app_role) THEN true
    ELSE user_id = (SELECT auth.uid()) AND deleted_at IS NULL
  END
);

-- Update SELECT policy for announcements to filter out soft-deleted
DROP POLICY IF EXISTS "Authenticated users can view announcements" ON public.announcements;
CREATE POLICY "view_announcements_policy" ON public.announcements
FOR SELECT TO authenticated
USING (
  CASE 
    WHEN has_role((SELECT auth.uid()), 'admin'::app_role) THEN true
    ELSE deleted_at IS NULL
  END
);

-- Add UPDATE policy for announcements (for soft delete)
CREATE POLICY "admin_update_announcements" ON public.announcements
FOR UPDATE TO authenticated
USING (has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));