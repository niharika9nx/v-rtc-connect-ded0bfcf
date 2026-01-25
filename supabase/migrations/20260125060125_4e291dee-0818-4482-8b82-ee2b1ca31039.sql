-- Add deleted_at column for soft delete
ALTER TABLE public.alerts 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for faster filtering of non-deleted alerts
CREATE INDEX idx_alerts_deleted_at ON public.alerts(deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policies to exclude soft-deleted alerts for regular users
-- Admins can still see all alerts including deleted ones

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "alerts_select_policy" ON public.alerts;

-- Create new SELECT policy that filters out deleted alerts for non-admins
CREATE POLICY "alerts_select_policy" ON public.alerts
FOR SELECT TO authenticated
USING (
  CASE 
    WHEN has_role((SELECT auth.uid()), 'admin'::app_role) THEN true
    ELSE user_id = (SELECT auth.uid()) AND deleted_at IS NULL
  END
);